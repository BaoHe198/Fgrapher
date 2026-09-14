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

// --- Credential emails -------------------------------------------------
//
// A verification or password-reset link is only worth delivering while it
// is the account's live credential. Issuing a new one kills the old token,
// but a retryable failure leaves the old email PENDING in the outbox, and
// the cron would later deliver a link that no longer works.
//
// The outbox has no column saying which account or credential a row
// belongs to, and this is solved without adding one: the idempotency key
// carries it. `credential:<type>:<accountId>:<issuanceId>` lets every row
// for one credential type on one account be found by prefix, and lets the
// sender re-check, from the key alone, whether its issuance is still live.

export const CREDENTIAL_EMAIL_TYPES = [
  "email-verification",
  "password-reset",
] as const;
export type CredentialEmailType = (typeof CREDENTIAL_EMAIL_TYPES)[number];

export interface CredentialIssuance {
  type: CredentialEmailType;
  /** The user id. */
  accountId: string;
  /** Identifies one issuance — a hash of that issuance's token, never the token. */
  issuanceId: string;
}

const CREDENTIAL_KEY_PREFIX = "credential";

function assertKeyPart(name: string, value: string) {
  // A ':' inside a part would let one account's prefix match another's key
  // (and break parsing), so the scoping guarantee depends on refusing it.
  if (!value || value.includes(":")) {
    throw new Error(
      `credential email key: invalid ${name} ${JSON.stringify(value)}`,
    );
  }
}

/** The trailing ':' is load-bearing: account `u1` must not match `u10`. */
export function credentialScopePrefix(
  type: CredentialEmailType,
  accountId: string,
): string {
  assertKeyPart("accountId", accountId);
  return `${CREDENTIAL_KEY_PREFIX}:${type}:${accountId}:`;
}

export function credentialEmailKey(issuance: CredentialIssuance): string {
  assertKeyPart("issuanceId", issuance.issuanceId);
  return (
    credentialScopePrefix(issuance.type, issuance.accountId) +
    issuance.issuanceId
  );
}

/** The issuance a key belongs to, or null for any non-credential email. */
export function parseCredentialEmailKey(
  key: string,
): CredentialIssuance | null {
  const parts = key.split(":");
  if (parts.length !== 4 || parts[0] !== CREDENTIAL_KEY_PREFIX) return null;
  const [, type, accountId, issuanceId] = parts;
  if (!(CREDENTIAL_EMAIL_TYPES as readonly string[]).includes(type)) {
    return null;
  }
  if (!accountId || !issuanceId) return null;
  return { type: type as CredentialEmailType, accountId, issuanceId };
}

/**
 * Key for an email with no natural event identity. Random by design: an
 * enqueue that doesn't opt into deduplication must always produce a new
 * row, so "no key supplied" can never mean "silently deduplicate".
 */
export function oneOffIdempotencyKey(): string {
  return `one-off:${crypto.randomUUID()}`;
}
