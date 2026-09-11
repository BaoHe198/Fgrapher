import type { NotificationType, Prisma } from "@prisma/client";

import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import {
  NOTIFICATION_POLICY,
  activeNotificationTypes as activeNotificationTypesFor,
  makeFeatureGate,
  resolveNotificationDelivery,
} from "@/lib/notifications";
import { emailIdempotencyKey } from "@/services/email-outbox-policy";
import type { NotificationPreferences } from "@/lib/validations/user";

// Feature-flag state is resolved here (server side) and passed into the
// pure policy in lib/notifications.ts — that module must not import
// lib/features.ts / lib/env.ts.
const featureGate = makeFeatureGate({
  marketplaceEnabled: features.marketplaceEnabled,
  socialFeedEnabled: features.socialFeedEnabled,
});

// The channel matrix — which NotificationType writes an in-app row, which
// may email, under which preference toggle, and which MVP feature it
// belongs to — lives in lib/notifications.ts (pure, unit-tested,
// documented in docs/ops/notification-matrix.md). This module is the thin
// side-effecting layer: it reads the recipient, asks the policy what to
// do, and performs the writes.

interface NotifyEmail {
  subject: string;
  html: string;
  /**
   * Event-identifying parts, e.g. `[bookingId, "CONFIRMED"]`. The recipient
   * id is always appended. Required whenever the policy says this type
   * emails — `buildEmailDedupe` throws without it rather than send an
   * un-deduplicated transactional email. For throttled types (NEW_MESSAGE)
   * these parts form the rolling-window scope key.
   */
  dedupe?: string[];
  /** The body embeds a credential — see EmailOutbox.sensitive. */
  sensitive?: boolean;
}

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
  email?: NotifyEmail;
}

/**
 * Builds the `sendEmail` idempotency/throttle options for this event.
 * - Throttled types (NEW_MESSAGE): a rolling-window reservation scoped to
 *   the recipient + the dedupe parts (the conversation).
 * - Everything else that emails: an event-scoped idempotency key,
 *   recipient-appended so the same event to two parties stays distinct.
 *
 * Fails closed: a type that is going to send an email but has no
 * `email.dedupe` is a programming error (it would send unkeyed, defeating
 * idempotency), so this throws rather than silently sending.
 */
export function buildEmailDedupe(
  type: NotificationType,
  userId: string,
  email: NotifyEmail,
): {
  idempotencyKey?: string;
  throttle?: { scopeKey: string; windowMs: number };
} {
  const { emailScope, throttleMs } = NOTIFICATION_POLICY[type];

  if (!emailScope) {
    // Policy says this type never emails — deliver() shouldn't have called
    // us. Guard anyway.
    throw new Error(`notify: ${type} has no email policy but an email payload`);
  }
  if (!email.dedupe || email.dedupe.length === 0) {
    throw new Error(
      `notify: ${type} email is missing event identity (email.dedupe) — ` +
        "refusing to send an un-deduplicated transactional email",
    );
  }

  const scopeKey = [emailScope, ...email.dedupe, userId].join(":");
  if (throttleMs) {
    return { throttle: { scopeKey, windowMs: throttleMs } };
  }
  return {
    idempotencyKey: emailIdempotencyKey(emailScope, ...email.dedupe, userId),
  };
}

async function deliver(input: NotifyInput, forceEmail: boolean) {
  const { userId, type, title, message, data, email } = input;

  // Types belonging to a disabled feature (marketplace/social) are inert —
  // no row, no email, not even for a "critical" forceEmail call — so a
  // flag flip can't leave orphaned notifications.
  if (!featureGate(NOTIFICATION_POLICY[type].feature)) return;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, notificationPreferences: true },
  });
  if (!user) return;

  const prefs = user.notificationPreferences as NotificationPreferences | null;
  const decision = resolveNotificationDelivery({
    type,
    prefs,
    hasEmailPayload: Boolean(email),
    isFeatureEnabled: featureGate,
  });

  if (decision.createInApp || forceEmail) {
    await db.notification.create({
      data: { userId, type, title, message, data: data ?? undefined },
    });
  }

  // Real-time delivery (Socket.io) is deferred — the notification bell
  // polls for this row.

  if ((decision.sendEmail || forceEmail) && email) {
    const { idempotencyKey, throttle } = buildEmailDedupe(type, userId, email);
    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
      idempotencyKey,
      throttle,
      sensitive: email.sensitive,
    });
  }
}

/**
 * In-app + (preference-gated) email notification. Honours the recipient's
 * per-type channel settings; a type whose feature is disabled does
 * nothing.
 */
export async function notify(input: NotifyInput) {
  await deliver(input, false);
}

/**
 * Account, billing, moderation and legal events (welcome, payment failed,
 * subscription ended, media decision, role change). Delivered on every
 * channel regardless of the recipient's notification settings — same
 * principle as a password-reset email.
 *
 * Only accepts types the policy marks `email: "critical"`; anything else
 * belongs on notify().
 */
export async function notifyCritical(input: NotifyInput) {
  if (NOTIFICATION_POLICY[input.type].email !== "critical") {
    throw new Error(
      `notifyCritical called with non-critical type ${input.type} — use notify()`,
    );
  }
  await deliver(input, true);
}

const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * Just the unread badge number.
 *
 * The bell polls while closed purely to keep that badge honest, and used to
 * call listNotifications() to get it — a findMany plus two counts, three
 * queries, to render one integer. Same type gate as the list read, so a
 * disabled feature's stale rows never inflate the badge either.
 */
export async function countUnreadNotifications(userId: string) {
  return db.notification.count({
    where: {
      userId,
      type: { in: activeNotificationTypesFor(featureGate) },
      readAt: null,
    },
  });
}

export async function listNotifications({
  userId,
  unreadOnly,
  page,
}: {
  userId: string;
  unreadOnly: boolean;
  page: number;
}) {
  // Gate disabled-feature types here, at the read boundary, so stale rows
  // written before a flag was turned off never surface in the bell, the
  // list, or the unread count.
  const typeFilter = { type: { in: activeNotificationTypesFor(featureGate) } };
  const where = {
    userId,
    ...typeFilter,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * NOTIFICATIONS_PAGE_SIZE,
      take: NOTIFICATIONS_PAGE_SIZE,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, ...typeFilter, readAt: null } }),
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
