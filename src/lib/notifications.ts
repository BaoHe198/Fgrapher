import type { NotificationType } from "@prisma/client";

import {
  NOTIFICATION_KEYS,
  type NotificationPreferences,
} from "@/lib/validations/user";

// Single source of truth for what every NotificationType does: whether it
// writes an in-app row, whether it may send an email and under which gate,
// which user-facing preference toggle governs it, and which MVP feature it
// belongs to. Both the server (services/notification.ts) and the
// notification UI derive their behaviour from this map, so the matrix in
// docs/ops/notification-matrix.md can't drift from the code.
//
// Deliberately pure: this module imports only types and the preference-key
// list. It must NOT import lib/features.ts — that pulls in lib/env.ts,
// which validates required server secrets at import time and is unsafe in
// a browser bundle. Feature-flag state is passed in from a server boundary
// via an `isFeatureEnabled` predicate (see makeFeatureGate).

export type NotificationPreferenceKey = (typeof NOTIFICATION_KEYS)[number];

/**
 * The MVP feature a notification belongs to. Anything not `"core"` is
 * hidden and inert whenever its feature flag is off: no in-app row, no
 * email, and it never appears in the notification list or the settings
 * screen. See CLAUDE.md "Ngoài phạm vi MVP".
 */
export type NotificationFeature = "core" | "marketplace" | "social";

/**
 * - `"none"` — never emails (in-app only, or a deliberately low-noise type).
 * - `"preference"` — emails when the recipient's channel preference allows.
 * - `"critical"` — always emails, like a password reset: an account, billing,
 *   moderation or legal event the recipient must see regardless of settings.
 */
export type NotificationEmailPolicy = "none" | "preference" | "critical";

export interface NotificationPolicyEntry {
  feature: NotificationFeature;
  /** Writes a Notification row (subject to the recipient's in-app toggle). */
  inApp: boolean;
  email: NotificationEmailPolicy;
  /** The settings toggle that governs this type's channels. */
  preferenceKey?: NotificationPreferenceKey;
  /**
   * Idempotency scope for the email (see emailIdempotencyKey). The caller
   * supplies the event-identifying parts; this keeps the scope prefix in
   * one place.
   */
  emailScope?: string;
  /**
   * When set, at most one email per recipient per conversation per this
   * many milliseconds, enforced by a rolling-window reservation (see
   * services/email-outbox.ts's reserveThrottledEmail). Used for
   * NEW_MESSAGE so a burst of chat messages can't become a burst of
   * emails.
   */
  throttleMs?: number;
}

export const MESSAGE_EMAIL_THROTTLE_MS = 15 * 60 * 1000;

export const NOTIFICATION_POLICY: Record<
  NotificationType,
  NotificationPolicyEntry
> = {
  // --- Bookings (core) --------------------------------------------------
  BOOKING_REQUEST: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "bookingRequest",
    emailScope: "booking-request",
  },
  BOOKING_CONFIRMED: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "bookingConfirmed",
    emailScope: "booking-status",
  },
  BOOKING_DECLINED: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "bookingCancelled",
    emailScope: "booking-status",
  },
  BOOKING_CANCELLED: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "bookingCancelled",
    emailScope: "booking-status",
  },
  BOOKING_REMINDER: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "bookingReminder",
    emailScope: "booking-reminder",
  },
  BOOKING_RESCHEDULE_PROPOSED: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "bookingRequest",
    emailScope: "booking-reschedule",
  },
  BOOKING_COMPLETED: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "bookingConfirmed",
    emailScope: "booking-status",
  },
  // --- Messaging (core) -----------------------------------------------
  NEW_MESSAGE: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "newMessage",
    emailScope: "new-message",
    throttleMs: MESSAGE_EMAIL_THROTTLE_MS,
  },
  // --- Reviews (core — CLAUDE.md MVP "đánh giá") ----------------------
  NEW_REVIEW: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "newReview",
    emailScope: "new-review",
  },
  REVIEW_RESPONSE: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "newReview",
    emailScope: "review-response",
  },
  // --- Reverse marketplace / service requests (core) ------------------
  REQUEST_NEW_MATCH: {
    // Broadcast to every matching provider — deliberately in-app only so a
    // new request can't fan out into dozens of emails. Providers watch the
    // opportunities feed for these.
    feature: "core",
    inApp: true,
    email: "none",
    preferenceKey: "serviceRequests",
  },
  REQUEST_NEW_OFFER: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "serviceRequests",
    emailScope: "request-offer",
  },
  REQUEST_OFFER_ACCEPTED: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "serviceRequests",
    emailScope: "request-offer",
  },
  REQUEST_OFFER_DECLINED: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "serviceRequests",
    emailScope: "request-offer",
  },
  REQUEST_NO_OFFERS_48H: {
    feature: "core",
    inApp: true,
    email: "preference",
    preferenceKey: "serviceRequests",
    emailScope: "request-nudge",
  },
  // --- Account / billing / moderation (core, always emailed) ---------
  // `critical` still carries an emailScope: the send is reserved in the
  // outbox before delivery exactly like a preference email, so a retried
  // billing cron can't double-send. The call site must pass `dedupe`.
  SUBSCRIPTION_ACTIVE: {
    feature: "core",
    inApp: true,
    email: "critical",
    emailScope: "subscription",
  },
  SUBSCRIPTION_EXPIRING: {
    feature: "core",
    inApp: true,
    email: "critical",
    emailScope: "subscription",
  },
  SUBSCRIPTION_CANCELLED: {
    feature: "core",
    inApp: true,
    email: "critical",
    emailScope: "subscription",
  },
  PAYMENT_FAILED: {
    feature: "core",
    inApp: true,
    email: "critical",
    emailScope: "payment",
  },
  MEDIA_APPROVED: {
    feature: "core",
    inApp: true,
    email: "critical",
    emailScope: "media",
  },
  MEDIA_REJECTED: {
    feature: "core",
    inApp: true,
    email: "critical",
    emailScope: "media",
  },
  ROLE_CHANGE_APPROVED: {
    feature: "core",
    inApp: true,
    email: "critical",
    emailScope: "role-change",
  },
  ROLE_CHANGE_REJECTED: {
    feature: "core",
    inApp: true,
    email: "critical",
    emailScope: "role-change",
  },
  // --- Social feed (out of MVP scope — dormant) ---------------------
  NEW_FOLLOWER: {
    feature: "social",
    inApp: true,
    email: "preference",
    preferenceKey: "newFollower",
  },
  NEW_LIKE: { feature: "social", inApp: true, email: "none" },
  NEW_COMMENT: { feature: "social", inApp: true, email: "none" },
  // --- Marketplace / camera shop (out of MVP scope — dormant) ------
  NEW_ORDER: { feature: "marketplace", inApp: true, email: "none" },
  ORDER_CONFIRMED: { feature: "marketplace", inApp: true, email: "none" },
  ORDER_SHIPPED: { feature: "marketplace", inApp: true, email: "none" },
  ORDER_DELIVERED: { feature: "marketplace", inApp: true, email: "none" },
  ORDER_CANCELLED: { feature: "marketplace", inApp: true, email: "none" },
};

export type FeatureGate = (feature: NotificationFeature) => boolean;

/** Builds the feature predicate from resolved flag values (server side). */
export function makeFeatureGate(flags: {
  marketplaceEnabled: boolean;
  socialFeedEnabled: boolean;
}): FeatureGate {
  return (feature) => {
    switch (feature) {
      case "core":
        return true;
      case "marketplace":
        return flags.marketplaceEnabled;
      case "social":
        return flags.socialFeedEnabled;
    }
  };
}

export function isNotificationTypeActive(
  type: NotificationType,
  isFeatureEnabled: FeatureGate,
): boolean {
  return isFeatureEnabled(NOTIFICATION_POLICY[type].feature);
}

export function activeNotificationTypes(
  isFeatureEnabled: FeatureGate,
): NotificationType[] {
  return (Object.keys(NOTIFICATION_POLICY) as NotificationType[]).filter(
    (type) => isNotificationTypeActive(type, isFeatureEnabled),
  );
}

/** Preference keys whose feature is live — the rows the settings UI shows. */
export function activePreferenceKeys(
  isFeatureEnabled: FeatureGate,
): NotificationPreferenceKey[] {
  const seen = new Set<NotificationPreferenceKey>();
  for (const type of activeNotificationTypes(isFeatureEnabled)) {
    const key = NOTIFICATION_POLICY[type].preferenceKey;
    if (key) seen.add(key);
  }
  return NOTIFICATION_KEYS.filter((key) => seen.has(key));
}

const DEFAULT_CHANNELS = { email: true, inApp: true };

export interface NotificationDelivery {
  createInApp: boolean;
  sendEmail: boolean;
  preferenceKey: NotificationPreferenceKey | null;
  emailScope: string | null;
  throttleMs: number | null;
}

/**
 * Pure resolution of a single notify() call into channel decisions. No
 * side effects — services/notification.ts performs the writes.
 */
export function resolveNotificationDelivery({
  type,
  prefs,
  hasEmailPayload,
  isFeatureEnabled,
}: {
  type: NotificationType;
  prefs: NotificationPreferences | null | undefined;
  hasEmailPayload: boolean;
  isFeatureEnabled: FeatureGate;
}): NotificationDelivery {
  const entry = NOTIFICATION_POLICY[type];

  const inert: NotificationDelivery = {
    createInApp: false,
    sendEmail: false,
    preferenceKey: entry.preferenceKey ?? null,
    emailScope: entry.emailScope ?? null,
    throttleMs: entry.throttleMs ?? null,
  };

  if (!isFeatureEnabled(entry.feature)) return inert;

  const channels = entry.preferenceKey
    ? (prefs?.[entry.preferenceKey] ?? DEFAULT_CHANNELS)
    : DEFAULT_CHANNELS;

  if (entry.email === "critical") {
    // Account/billing/legal — delivered on every channel regardless of the
    // recipient's settings, same principle as a password-reset email.
    return {
      ...inert,
      createInApp: entry.inApp,
      sendEmail: hasEmailPayload,
    };
  }

  return {
    ...inert,
    createInApp: entry.inApp && channels.inApp,
    sendEmail:
      entry.email === "preference" && hasEmailPayload && channels.email,
  };
}

/**
 * Whether `now` still falls inside the throttle window opened by an email
 * sent at `lastSentAt`. The boundary is exclusive on the window end: a
 * send exactly `windowMs` later is allowed again.
 */
export function isWithinThrottleWindow(
  lastSentAt: Date | null,
  now: Date,
  windowMs: number,
): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - lastSentAt.getTime() < windowMs;
}

export const MESSAGE_PREVIEW_MAX = 140;

/**
 * One-line preview of a chat message for a notification title/email. The
 * template layer escapes this for HTML; this only collapses whitespace and
 * truncates so a wall-of-text message can't blow out the notification row
 * or the email subject-adjacent line.
 */
export function messagePreview(
  content: string,
  max = MESSAGE_PREVIEW_MAX,
): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}
