import crypto from "crypto";

import type { EmailOutboxStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  type CredentialEmailType,
  type CredentialIssuance,
  MAX_ATTEMPTS,
  credentialScopePrefix,
} from "@/services/email-outbox-policy";

// Keeps a credential email (verification link, password-reset link) from
// being delivered after the credential in it stopped being the account's
// live one.
//
// The bug: issuing a new link replaces the token, but an earlier email that
// hit a retryable failure is still PENDING in the outbox and the cron later
// sends that dead link — often after the good one, so it is the email the
// user actually clicks.
//
// The invariant: for one credential type on one account, the only outbox
// row that can be retry-eligible (PENDING) is the newest issuance's. Three
// things enforce it, all under one per-(type, account) advisory lock so
// they serialise against each other:
//
//  1. issueCredential — writes the new token and, in the same locked
//     transaction, supersedes every PENDING row already queued for that
//     type/account. From that moment no older link is queued.
//  2. settleCredentialRow — the only way a credential row becomes PENDING
//     after a failed attempt. It re-checks, under the lock, that the row's
//     issuance is still live; if not, the row is superseded instead. This
//     is what stops an OLDER issuance whose send was still in flight from
//     queueing itself after a NEWER issuance already cleared the queue.
//  3. claimCredentialRow — the cron's claim. Same re-check before a row is
//     taken for sending, which also covers the crash-recovery paths that
//     return a row to PENDING without going through settle (stale-lock
//     sweep, per-row error release).
//
// Deliberately never touched: SENDING rows (an attempt in flight belongs to
// whoever claimed it — see settleCredentialRow for how it resolves itself),
// SENT/FAILED rows, other credential types, other accounts, and every
// non-credential email. The lock is never held across a network call.
//
// No schema change: a superseded row is FAILED with SUPERSEDED_ERROR and its
// credential-bearing body scrubbed, like any other terminal sensitive row.

export const SUPERSEDED_ERROR = "credential_no_longer_current";

export type CredentialTokenWrite =
  | {
      type: "email-verification";
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    }
  | {
      type: "password-reset";
      userId: string;
      /** The address the token is filed under (VerificationToken.identifier). */
      identifier: string;
      token: string;
      expires: Date;
    };

/** Row fields written after an attempt — what the outbox already writes. */
export interface OutboxRowWrite {
  status: EmailOutboxStatus;
  nextAttemptAt: Date | null;
  sentAt: Date | null;
  lockedAt: null;
  html?: null;
  providerId: string | null;
  lastError: string | null;
}

/**
 * Operations available while holding a credential scope's lock. Implemented
 * by Prisma in production and by an in-memory model in the tests; both
 * filter with the where-builders below, so the tests exercise the real
 * scoping rather than a copy of it.
 */
export interface CredentialLockedOps {
  writeToken(write: CredentialTokenWrite): Promise<{ id: string | null }>;
  isCurrent(issuance: CredentialIssuance, now: Date): Promise<boolean>;
  supersedeRows(where: Prisma.EmailOutboxWhereInput): Promise<number>;
  writeRow(id: string, write: OutboxRowWrite): Promise<void>;
  claimRows(where: Prisma.EmailOutboxWhereInput): Promise<number>;
}

export interface CredentialStore {
  withLock<T>(
    scope: { type: CredentialEmailType; accountId: string },
    fn: (ops: CredentialLockedOps) => Promise<T>,
  ): Promise<T>;
}

// --- Shared, pure pieces ------------------------------------------------

export function hashCredentialToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function issuanceFor(write: CredentialTokenWrite): CredentialIssuance {
  return {
    type: write.type,
    accountId: write.userId,
    issuanceId:
      write.type === "email-verification"
        ? write.tokenHash
        : hashCredentialToken(write.token),
  };
}

/**
 * Queued retries a new issuance cancels: PENDING rows of this type on this
 * account, and nothing else. `startsWith` on a prefix ending in ':' cannot
 * reach another account or type; the status filter keeps SENDING, SENT and
 * FAILED rows out of it.
 */
export function supersedableWhere(
  type: CredentialEmailType,
  accountId: string,
): Prisma.EmailOutboxWhereInput {
  return {
    idempotencyKey: { startsWith: credentialScopePrefix(type, accountId) },
    status: "PENDING",
  };
}

/** Terminal state for a superseded row. Scrubs the dead link's body. */
export const SUPERSEDED_FIELDS = {
  status: "FAILED",
  nextAttemptAt: null,
  lockedAt: null,
  html: null,
  lastError: SUPERSEDED_ERROR,
} as const satisfies Prisma.EmailOutboxUpdateManyMutationInput;

/** The cron's claim condition — identical to the non-credential claim. */
export function claimableWhere(
  id: string,
  startedAt: Date,
): Prisma.EmailOutboxWhereInput {
  return {
    id,
    status: "PENDING",
    nextAttemptAt: { lte: startedAt },
    attempts: { lt: MAX_ATTEMPTS },
  };
}

export const CLAIM_FIELDS = (now: Date) =>
  ({
    status: "SENDING",
    lockedAt: now,
    attempts: { increment: 1 },
  }) as const satisfies Prisma.EmailOutboxUpdateManyMutationInput;

/** A verification issuance is live while its hash is the user's stored token and unexpired. */
export function isVerificationIssuanceCurrent(
  stored: { tokenHash: string; expiresAt: Date } | null,
  issuance: CredentialIssuance,
  now: Date,
): boolean {
  return (
    stored !== null &&
    stored.tokenHash === issuance.issuanceId &&
    stored.expiresAt.getTime() > now.getTime()
  );
}

/** A reset issuance is live while an unexpired token under the account's address hashes to it. */
export function isResetIssuanceCurrent(
  stored: readonly { token: string; expires: Date }[],
  issuance: CredentialIssuance,
  now: Date,
): boolean {
  return stored.some(
    (t) =>
      t.expires.getTime() > now.getTime() &&
      hashCredentialToken(t.token) === issuance.issuanceId,
  );
}

// --- The three guarded operations ----------------------------------------

/**
 * Makes `write` the account's live credential of its type and cancels every
 * retry still queued for an older one, atomically with respect to settle
 * and claim.
 */
export async function issueCredential(
  write: CredentialTokenWrite,
  store: CredentialStore,
): Promise<{
  issuance: CredentialIssuance;
  tokenRowId: string | null;
  superseded: number;
}> {
  const issuance = issuanceFor(write);
  return store.withLock(
    { type: issuance.type, accountId: issuance.accountId },
    async (ops) => {
      const { id } = await ops.writeToken(write);
      // The new issuance has no outbox row yet, so every PENDING row in the
      // scope belongs to an older one.
      const superseded = await ops.supersedeRows(
        supersedableWhere(issuance.type, issuance.accountId),
      );
      return { issuance, tokenRowId: id, superseded };
    },
  );
}

/**
 * Applies an attempt's outcome to a credential row the caller holds (it is
 * SENDING: reserved by the immediate send, or claimed by the cron).
 *
 * Only a PENDING outcome needs the currency check — a delivered email is
 * recorded as SENT regardless (it already went out), and a permanent failure
 * is terminal anyway. A PENDING outcome for an issuance that is no longer
 * live becomes superseded rather than queued. This is the row's own claimant
 * resolving it, which is why touching a SENDING row here is correct while a
 * newer issuance must never do so.
 */
export async function settleCredentialRow(
  {
    id,
    issuance,
    write,
    now = new Date(),
  }: {
    id: string;
    issuance: CredentialIssuance;
    write: OutboxRowWrite;
    now?: Date;
  },
  store: CredentialStore,
): Promise<"written" | "superseded"> {
  return store.withLock(
    { type: issuance.type, accountId: issuance.accountId },
    async (ops) => {
      if (write.status === "PENDING" && !(await ops.isCurrent(issuance, now))) {
        await ops.supersedeRows({ id, status: "SENDING" });
        return "superseded";
      }
      await ops.writeRow(id, write);
      return "written";
    },
  );
}

/**
 * The cron's claim for a credential row. A row whose issuance is no longer
 * live is superseded instead of sent, however it got back to PENDING.
 */
export async function claimCredentialRow(
  {
    id,
    issuance,
    startedAt,
  }: { id: string; issuance: CredentialIssuance; startedAt: Date },
  store: CredentialStore,
): Promise<"claimed" | "skipped" | "superseded"> {
  return store.withLock(
    { type: issuance.type, accountId: issuance.accountId },
    async (ops) => {
      if (!(await ops.isCurrent(issuance, startedAt))) {
        const n = await ops.supersedeRows({ id, status: "PENDING" });
        return n === 1 ? "superseded" : "skipped";
      }
      const n = await ops.claimRows(claimableWhere(id, startedAt));
      return n === 1 ? "claimed" : "skipped";
    },
  );
}

// --- Production store -----------------------------------------------------

export const prismaCredentialStore: CredentialStore = {
  withLock(scope, fn) {
    return db.$transaction(async (tx) => {
      // Transaction-scoped advisory lock, released on COMMIT/ROLLBACK — same
      // mechanism as prismaThrottleReservationStore. Held only for these few
      // short statements, never across delivery.
      const lockKey = `credential-issuance:${scope.type}:${scope.accountId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

      const ops: CredentialLockedOps = {
        async writeToken(write) {
          if (write.type === "email-verification") {
            // userId is @unique, so this keeps one live token per user. The
            // lock already serialises issuances for this user, so the old
            // lost-update retry for concurrent inserts isn't needed here.
            const row = await tx.emailVerificationToken.upsert({
              where: { userId: write.userId },
              create: {
                userId: write.userId,
                tokenHash: write.tokenHash,
                expiresAt: write.expiresAt,
              },
              update: {
                tokenHash: write.tokenHash,
                expiresAt: write.expiresAt,
                createdAt: new Date(),
              },
              select: { id: true },
            });
            return { id: row.id };
          }
          // VerificationToken.identifier isn't unique, so delete-then-create
          // on its own let two concurrent resets both survive. Under the
          // lock only one issuance runs at a time: one live reset token.
          await tx.verificationToken.deleteMany({
            where: { identifier: write.identifier },
          });
          await tx.verificationToken.create({
            data: {
              identifier: write.identifier,
              token: write.token,
              expires: write.expires,
            },
          });
          return { id: null };
        },

        async isCurrent(issuance, now) {
          if (issuance.type === "email-verification") {
            const stored = await tx.emailVerificationToken.findUnique({
              where: { userId: issuance.accountId },
              select: { tokenHash: true, expiresAt: true },
            });
            return isVerificationIssuanceCurrent(stored, issuance, now);
          }
          const user = await tx.user.findUnique({
            where: { id: issuance.accountId },
            select: { email: true },
          });
          if (!user) return false;
          const stored = await tx.verificationToken.findMany({
            where: { identifier: user.email },
            select: { token: true, expires: true },
          });
          return isResetIssuanceCurrent(stored, issuance, now);
        },

        async supersedeRows(where) {
          const { count } = await tx.emailOutbox.updateMany({
            where,
            data: SUPERSEDED_FIELDS,
          });
          return count;
        },

        async writeRow(id, write) {
          await tx.emailOutbox.update({ where: { id }, data: write });
        },

        async claimRows(where) {
          const { count } = await tx.emailOutbox.updateMany({
            where,
            data: CLAIM_FIELDS(new Date()),
          });
          return count;
        },
      };

      return fn(ops);
    });
  },
};
