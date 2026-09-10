import crypto from "crypto";

// The outbox's retry policy, deliberately kept in its own module with no
// imports of `db` or `env`: it's the part worth unit-testing, and a test
// that has to boot Prisma and a validated env just to check a backoff
// curve ends up re-implementing the curve instead (which is what the
// original outbox tests did — they asserted against a private copy of
// these functions, so production could drift, and it had: the documented
// "first retry after 1 minute" was actually 2 minutes in production).

export const MAX_ATTEMPTS = 5;
export const BASE_BACKOFF_MS = 60 * 1000; // 1 minute

// A row claimed for sending that never reached a terminal state (the
// function was killed mid-send, the lambda froze) would otherwise sit in
// SENDING forever. Ten minutes is well past the cron's own 60s maxDuration.
export const STALE_LOCK_MS = 10 * 60 * 1000;

export type EmailOutboxStatusValue = "PENDING" | "SENDING" | "SENT" | "FAILED";

/**
 * Backoff before retry number `attempts` (1-based: `attempts` is the count
 * of attempts already made, so after the first failure this is called with
 * 1 and returns 1 minute).
 *
 * Doubles per attempt, capped: 1m → 2m → 4m → 8m → 16m.
 */
export function getBackoffMs(attempts: number): number {
  const exponent = Math.min(Math.max(attempts, 1) - 1, 4);
  return BASE_BACKOFF_MS * 2 ** exponent;
}

export function getNextAttemptTime(attempts: number, now: Date = new Date()) {
  return new Date(now.getTime() + getBackoffMs(attempts));
}

export interface AttemptOutcome {
  status: EmailOutboxStatusValue;
  nextAttemptAt: Date | null;
  sentAt: Date | null;
}

/**
 * The row state after one delivery attempt. Single source of truth so
 * status, attempt count and schedule can't contradict each other — the
 * original wrote `status: FAILED` together with a `nextAttemptAt` 24 hours
 * out, a schedule nothing would ever act on because the processor only
 * selects PENDING rows.
 */
export function resolveAttemptOutcome({
  attempts,
  error,
  retryable,
  now = new Date(),
}: {
  /** Attempts made *including* the one just completed. */
  attempts: number;
  error?: string;
  retryable?: boolean;
  now?: Date;
}): AttemptOutcome {
  if (!error) {
    return { status: "SENT", nextAttemptAt: null, sentAt: now };
  }

  // A permanent rejection (malformed address, unverified domain) will fail
  // identically every time — burn it now instead of five times over 30
  // minutes.
  if (retryable === false || attempts >= MAX_ATTEMPTS) {
    return { status: "FAILED", nextAttemptAt: null, sentAt: null };
  }

  return {
    status: "PENDING",
    nextAttemptAt: getNextAttemptTime(attempts, now),
    sentAt: null,
  };
}

/**
 * Idempotency key for an email that represents a specific *event*, e.g.
 * `emailIdempotencyKey("email-verification", tokenId)`.
 *
 * The key must be event-scoped, never content-scoped. Hashing
 * recipient+subject+body — the original approach — silently collapses two
 * legitimately distinct emails that happen to read the same: a second
 * booking reminder for the same booking, a re-requested verification
 * link, the same contact-form message sent twice. Worse, the colliding
 * row is usually already SENT, so the second email is dropped forever
 * rather than merely delayed.
 */
export function emailIdempotencyKey(scope: string, ...parts: string[]): string {
  return `${scope}:${parts.join(":")}`;
}

/**
 * Key for an email with no natural event identity. Random by design: an
 * enqueue that doesn't opt into deduplication must always produce a new
 * row, so "no key supplied" can never mean "silently deduplicate".
 */
export function oneOffIdempotencyKey(): string {
  return `one-off:${crypto.randomUUID()}`;
}
