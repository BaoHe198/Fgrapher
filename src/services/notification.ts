import type { NotificationType, Prisma } from "@prisma/client";

import { sendEmail, sendMarketingEmail } from "@/lib/email";
import { db } from "@/lib/db";
import {
  NOTIFICATION_KEYS,
  type NotificationPreferences,
} from "@/lib/validations/user";
import { hasConsent } from "@/services/compliance";

// Maps each NotificationType to the user-facing preference key it's gated
// by. Types with no dedicated toggle (likes/comments/billing) are always
// sent in-app and never emailed — there's no key for them to opt out of
// email noise, so email defaults to off rather than guessing.
//
// Every NotificationType currently defined (prisma/schema.prisma) is
// transactional — tied to a booking, message, order, review, or
// subscription event the recipient is directly a party to — so none of
// them require ConsentPurpose.MARKETING. "productUpdates" and "tips" (the
// "Marketing" group in dashboard/settings/notifications) have no
// NotificationType wired to them yet; MARKETING_PREFERENCE_KEYS is where
// the consent gate below applies once a promotional NotificationType is
// added — do not add one without also updating that set.
const PREFERENCE_KEY: Partial<
  Record<NotificationType, (typeof NOTIFICATION_KEYS)[number]>
> = {
  BOOKING_REQUEST: "bookingRequest",
  BOOKING_CONFIRMED: "bookingConfirmed",
  BOOKING_DECLINED: "bookingCancelled",
  BOOKING_CANCELLED: "bookingCancelled",
  BOOKING_REMINDER: "bookingReminder",
  BOOKING_RESCHEDULE_PROPOSED: "bookingRequest",
  BOOKING_COMPLETED: "bookingConfirmed",
  NEW_MESSAGE: "newMessage",
  NEW_FOLLOWER: "newFollower",
  NEW_REVIEW: "newReview",
};

const MARKETING_PREFERENCE_KEYS = new Set<(typeof NOTIFICATION_KEYS)[number]>([
  "productUpdates",
  "tips",
]);

const DEFAULT_CHANNELS = { email: true, inApp: true };

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
  email?: { subject: string; html: string };
}

export async function notify({
  userId,
  type,
  title,
  message,
  data,
  email,
}: NotifyInput) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, notificationPreferences: true },
  });
  if (!user) return;

  const prefKey = PREFERENCE_KEY[type];
  const prefs = user.notificationPreferences as NotificationPreferences | null;
  const channels = prefKey
    ? (prefs?.[prefKey] ?? DEFAULT_CHANNELS)
    : { email: false, inApp: true };

  if (channels.inApp) {
    await db.notification.create({
      data: { userId, type, title, message, data: data ?? undefined },
    });
  }

  // Real-time delivery (Socket.io) is wired up in Phase 8 — until then the
  // notification bell picks this up on its own poll/refetch.

  if (channels.email && email) {
    if (prefKey && MARKETING_PREFERENCE_KEYS.has(prefKey)) {
      await sendMarketingEmail({
        to: user.email,
        subject: email.subject,
        html: email.html,
        hasMarketingConsent: await hasConsent(userId, "MARKETING"),
      });
    } else {
      await sendEmail({
        to: user.email,
        subject: email.subject,
        html: email.html,
      });
    }
  }
}

// Billing/account events (welcome, payment failed, subscription ended) are
// never preference-gated — same principle as password-reset emails: the
// user needs to see these regardless of their notification settings.
export async function notifyCritical({
  userId,
  type,
  title,
  message,
  data,
  email,
}: NotifyInput) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return;

  await db.notification.create({
    data: { userId, type, title, message, data: data ?? undefined },
  });

  if (email) {
    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
    });
  }
}

const NOTIFICATIONS_PAGE_SIZE = 20;

export async function listNotifications({
  userId,
  unreadOnly,
  page,
}: {
  userId: string;
  unreadOnly: boolean;
  page: number;
}) {
  const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * NOTIFICATIONS_PAGE_SIZE,
      take: NOTIFICATIONS_PAGE_SIZE,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page,
    totalPages: Math.max(1, Math.ceil(total / NOTIFICATIONS_PAGE_SIZE)),
  };
}

export async function markNotificationRead(id: string, userId: string) {
  await db.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
