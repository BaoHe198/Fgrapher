import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BASE_BACKOFF_MS,
  MAX_ATTEMPTS,
  emailIdempotencyKey,
  getBackoffMs,
  getNextAttemptTime,
  oneOffIdempotencyKey,
  resolveAttemptOutcome,
} from "@/services/email-outbox-policy";

// These import the real policy module. The previous version of this file
// defined its own private copies of the backoff and key functions and
// asserted against those, so it passed while disagreeing with production —
// it documented a first retry at 1 minute that production scheduled at 2.

const MINUTE = 60 * 1000;

describe("getBackoffMs", () => {
  it("waits one minute before the first retry", () => {
    assert.equal(getBackoffMs(1), MINUTE);
  });

  it("doubles per attempt", () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5].map(getBackoffMs),
      [1, 2, 4, 8, 16].map((m) => m * MINUTE),
    );
  });

  it("caps rather than growing without bound", () => {
    assert.equal(getBackoffMs(20), getBackoffMs(5));
  });

  it("treats a zero/negative attempt count as the first attempt", () => {
    assert.equal(getBackoffMs(0), BASE_BACKOFF_MS);
    assert.equal(getBackoffMs(-3), BASE_BACKOFF_MS);
  });
});

describe("getNextAttemptTime", () => {
  it("schedules relative to the supplied clock", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    assert.equal(
      getNextAttemptTime(1, now).toISOString(),
      "2026-09-10T00:01:00.000Z",
    );
    assert.equal(
      getNextAttemptTime(3, now).toISOString(),
      "2026-09-10T00:04:00.000Z",
    );
  });
});

describe("resolveAttemptOutcome", () => {
  const now = new Date("2026-09-10T00:00:00.000Z");

  it("marks a successful attempt SENT with no further schedule", () => {
    assert.deepEqual(resolveAttemptOutcome({ attempts: 1, now }), {
      status: "SENT",
      nextAttemptAt: null,
      sentAt: now,
    });
  });

  it("requeues a retryable failure with backoff", () => {
    const outcome = resolveAttemptOutcome({
      attempts: 2,
      error: "connection reset",
      retryable: true,
      now,
    });
    assert.equal(outcome.status, "PENDING");
    assert.equal(outcome.sentAt, null);
    assert.equal(
      outcome.nextAttemptAt?.toISOString(),
      "2026-09-10T00:02:00.000Z",
    );
  });

  it("gives up once the attempt budget is spent", () => {
    const outcome = resolveAttemptOutcome({
      attempts: MAX_ATTEMPTS,
      error: "connection reset",
      retryable: true,
      now,
    });
    assert.equal(outcome.status, "FAILED");
    // A terminal row must not carry a schedule: the processor only selects
    // PENDING rows, so a nextAttemptAt here is a date nothing acts on.
    assert.equal(outcome.nextAttemptAt, null);
  });

  it("burns a permanent rejection immediately instead of retrying it", () => {
    const outcome = resolveAttemptOutcome({
      attempts: 1,
      error: "Invalid `to` field",
      retryable: false,
      now,
    });
    assert.equal(outcome.status, "FAILED");
    assert.equal(outcome.nextAttemptAt, null);
  });
});

describe("idempotency keys", () => {
  it("is stable for the same event", () => {
    assert.equal(
      emailIdempotencyKey("email-verification", "tok_123"),
      emailIdempotencyKey("email-verification", "tok_123"),
    );
  });

  it("separates different events in the same scope", () => {
    assert.notEqual(
      emailIdempotencyKey("email-verification", "tok_123"),
      emailIdempotencyKey("email-verification", "tok_456"),
    );
  });

  it("separates the same id in different scopes", () => {
    assert.notEqual(
      emailIdempotencyKey("booking-reminder", "bk_1"),
      emailIdempotencyKey("booking-confirmed", "bk_1"),
    );
  });

  it("does not collapse two legitimate emails that read identically", () => {
    // The regression this whole module exists for: keying on
    // recipient+subject+body made a second reminder for the same booking
    // collide with the first, and because the colliding row was already
    // SENT the second email was dropped rather than delayed.
    const first = emailIdempotencyKey("booking-reminder", "bk_1", "2026-09-10");
    const second = emailIdempotencyKey(
      "booking-reminder",
      "bk_1",
      "2026-09-17",
    );
    assert.notEqual(first, second);
  });

  it("generates a distinct key every time when no event is supplied", () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => oneOffIdempotencyKey()),
    );
    assert.equal(keys.size, 50, "an unkeyed enqueue must always send");
  });
});
