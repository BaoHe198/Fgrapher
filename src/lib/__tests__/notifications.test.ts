import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotificationType } from "@prisma/client";

import {
  MESSAGE_PREVIEW_MAX,
  NOTIFICATION_POLICY,
  activeNotificationTypes,
  activePreferenceKeys,
  isWithinThrottleWindow,
  makeFeatureGate,
  messagePreview,
  resolveNotificationDelivery,
} from "@/lib/notifications";
import { buildEmailDedupe } from "@/services/notification";
import type { NotificationPreferences } from "@/lib/validations/user";

// Exercises the real policy map + the real resolution logic that
// services/notification.ts delegates to — the matrix in
// docs/ops/notification-matrix.md is asserted here, not just described.

const allOn = makeFeatureGate({
  marketplaceEnabled: true,
  socialFeedEnabled: true,
});
const mvpDefault = makeFeatureGate({
  marketplaceEnabled: false,
  socialFeedEnabled: false,
});

// A preferences object with every key present (what the settings UI
// actually PATCHes), so a test can flip one channel and leave the rest.
function prefs(
  overrides: Partial<Record<string, { email: boolean; inApp: boolean }>> = {},
): NotificationPreferences {
  const base: Record<string, { email: boolean; inApp: boolean }> = {};
  for (const key of [
    "bookingRequest",
    "bookingConfirmed",
    "bookingCancelled",
    "bookingReminder",
    "newMessage",
    "serviceRequests",
    "newFollower",
    "newReview",
    "productUpdates",
    "tips",
  ]) {
    base[key] = { email: true, inApp: true };
  }
  return { ...base, ...overrides } as NotificationPreferences;
}

describe("NOTIFICATION_POLICY", () => {
  it("has an entry for every NotificationType the schema defines", () => {
    for (const type of Object.values(NotificationType)) {
      assert.ok(NOTIFICATION_POLICY[type], `missing policy entry for ${type}`);
    }
    assert.equal(
      Object.keys(NOTIFICATION_POLICY).length,
      Object.values(NotificationType).length,
      "NOTIFICATION_POLICY has stale entries",
    );
  });

  it("only lets a 'preference' type name a preference key; 'critical' never does", () => {
    for (const [type, entry] of Object.entries(NOTIFICATION_POLICY)) {
      if (entry.email === "critical") {
        assert.equal(
          entry.preferenceKey,
          undefined,
          `${type} is critical but has a preference key`,
        );
      }
      if (entry.emailScope) {
        assert.notEqual(
          entry.email,
          "none",
          `${type} has an emailScope but never emails`,
        );
      }
    }
  });
});

describe("feature gating", () => {
  it("hides marketplace and social types under the MVP default flags", () => {
    const active = new Set(activeNotificationTypes(mvpDefault));
    assert.ok(!active.has("NEW_ORDER"));
    assert.ok(!active.has("ORDER_SHIPPED"));
    assert.ok(!active.has("NEW_FOLLOWER"));
    assert.ok(!active.has("NEW_LIKE"));
    // Reviews are core MVP even though the notification UI once grouped
    // them as "social".
    assert.ok(active.has("NEW_REVIEW"));
    assert.ok(active.has("REVIEW_RESPONSE"));
    assert.ok(active.has("REQUEST_NEW_OFFER"));
  });

  it("re-includes them once their flag is on", () => {
    const active = new Set(activeNotificationTypes(allOn));
    assert.ok(active.has("NEW_ORDER"));
    assert.ok(active.has("NEW_FOLLOWER"));
    assert.equal(active.size, Object.values(NotificationType).length);
  });

  it("only surfaces preference keys whose feature is live", () => {
    assert.deepEqual(activePreferenceKeys(mvpDefault), [
      "bookingRequest",
      "bookingConfirmed",
      "bookingCancelled",
      "bookingReminder",
      "newMessage",
      "serviceRequests",
      "newReview",
    ]);
    assert.ok(activePreferenceKeys(allOn).includes("newFollower"));
  });
});

describe("resolveNotificationDelivery", () => {
  it("a dormant type does nothing, even with a payload", () => {
    const d = resolveNotificationDelivery({
      type: "NEW_ORDER",
      prefs: prefs(),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.deepEqual(
      { createInApp: d.createInApp, sendEmail: d.sendEmail },
      { createInApp: false, sendEmail: false },
    );
  });

  it("that same type delivers once its flag is on", () => {
    const d = resolveNotificationDelivery({
      type: "NEW_ORDER",
      prefs: prefs(),
      hasEmailPayload: true,
      isFeatureEnabled: allOn,
    });
    assert.equal(d.createInApp, true);
    // NEW_ORDER is email:"none" — in-app only.
    assert.equal(d.sendEmail, false);
  });

  it("defaults an absent preferences object to both channels on", () => {
    const d = resolveNotificationDelivery({
      type: "BOOKING_CONFIRMED",
      prefs: null,
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(d.createInApp, true);
    assert.equal(d.sendEmail, true);
  });

  it("honours the email toggle without touching the in-app one", () => {
    const d = resolveNotificationDelivery({
      type: "BOOKING_CONFIRMED",
      prefs: prefs({ bookingConfirmed: { email: false, inApp: true } }),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(d.createInApp, true);
    assert.equal(d.sendEmail, false);
  });

  it("honours the in-app toggle", () => {
    const d = resolveNotificationDelivery({
      type: "BOOKING_CONFIRMED",
      prefs: prefs({ bookingConfirmed: { email: true, inApp: false } }),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(d.createInApp, false);
    assert.equal(d.sendEmail, true);
  });

  it("never emails without a payload", () => {
    const d = resolveNotificationDelivery({
      type: "BOOKING_CONFIRMED",
      prefs: prefs(),
      hasEmailPayload: false,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(d.sendEmail, false);
  });

  it("a critical type emails regardless of any preference", () => {
    const d = resolveNotificationDelivery({
      type: "PAYMENT_FAILED",
      prefs: prefs(),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(d.createInApp, true);
    assert.equal(d.sendEmail, true);
  });

  it("REQUEST_NEW_MATCH is in-app only but still honours its toggle", () => {
    const withPayload = resolveNotificationDelivery({
      type: "REQUEST_NEW_MATCH",
      prefs: prefs(),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(withPayload.sendEmail, false);
    assert.equal(withPayload.createInApp, true);

    const optedOut = resolveNotificationDelivery({
      type: "REQUEST_NEW_MATCH",
      prefs: prefs({ serviceRequests: { email: true, inApp: false } }),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(optedOut.createInApp, false);
  });

  it("carries the throttle window through for NEW_MESSAGE only", () => {
    const msg = resolveNotificationDelivery({
      type: "NEW_MESSAGE",
      prefs: prefs(),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(msg.throttleMs, 15 * 60 * 1000);
    const booking = resolveNotificationDelivery({
      type: "BOOKING_CONFIRMED",
      prefs: prefs(),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    });
    assert.equal(booking.throttleMs, null);
  });
});

describe("resolveNotificationDelivery is deterministic", () => {
  it("returns the same decision for repeated calls with the same inputs", () => {
    const args = {
      type: "BOOKING_CONFIRMED" as const,
      prefs: prefs({ bookingConfirmed: { email: false, inApp: true } }),
      hasEmailPayload: true,
      isFeatureEnabled: mvpDefault,
    };
    const a = resolveNotificationDelivery(args);
    const b = resolveNotificationDelivery(args);
    assert.deepEqual(a, b);
  });
});

describe("buildEmailDedupe (fail-closed event identity)", () => {
  it("builds an idempotency key from scope + parts + recipient", () => {
    const { idempotencyKey, throttle } = buildEmailDedupe(
      "BOOKING_CONFIRMED",
      "user_1",
      { subject: "s", html: "h", dedupe: ["booking_9", "CONFIRMED"] },
    );
    assert.equal(throttle, undefined);
    assert.equal(idempotencyKey, "booking-status:booking_9:CONFIRMED:user_1");
  });

  it("builds a rolling-window throttle for NEW_MESSAGE, recipient+conversation scoped", () => {
    const { idempotencyKey, throttle } = buildEmailDedupe(
      "NEW_MESSAGE",
      "user_1",
      { subject: "s", html: "h", dedupe: ["conv_5"] },
    );
    assert.equal(idempotencyKey, undefined);
    assert.equal(throttle?.scopeKey, "new-message:conv_5:user_1");
    assert.equal(throttle?.windowMs, 15 * 60 * 1000);
  });

  it("throws rather than send an un-deduplicated transactional email", () => {
    assert.throws(
      () =>
        buildEmailDedupe("BOOKING_CONFIRMED", "user_1", {
          subject: "s",
          html: "h",
        }),
      /missing event identity/,
    );
    assert.throws(
      () =>
        buildEmailDedupe("BOOKING_CONFIRMED", "user_1", {
          subject: "s",
          html: "h",
          dedupe: [],
        }),
      /missing event identity/,
    );
  });
});

describe("messagePreview", () => {
  it("collapses whitespace and leaves a short message intact", () => {
    assert.equal(messagePreview("  hello   world \n\n"), "hello world");
  });

  it("truncates a long message with an ellipsis and never exceeds the cap", () => {
    const long = "a ".repeat(200);
    const preview = messagePreview(long);
    assert.ok(preview.length <= MESSAGE_PREVIEW_MAX);
    assert.ok(preview.endsWith("…"));
  });

  it("does not add an ellipsis at exactly the cap", () => {
    const exact = "x".repeat(MESSAGE_PREVIEW_MAX);
    assert.equal(messagePreview(exact), exact);
  });
});

describe("isWithinThrottleWindow", () => {
  const window = 15 * 60 * 1000;
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("is false when nothing has been sent", () => {
    assert.equal(isWithinThrottleWindow(null, now, window), false);
  });

  it("is true one millisecond before the window closes", () => {
    const last = new Date(now.getTime() - window + 1);
    assert.equal(isWithinThrottleWindow(last, now, window), true);
  });

  it("is false exactly at the window boundary", () => {
    const last = new Date(now.getTime() - window);
    assert.equal(isWithinThrottleWindow(last, now, window), false);
  });

  it("is false well past the window", () => {
    const last = new Date(now.getTime() - window - 60_000);
    assert.equal(isWithinThrottleWindow(last, now, window), false);
  });
});
