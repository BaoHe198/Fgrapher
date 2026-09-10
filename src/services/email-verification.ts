import crypto from "crypto";

import { Prisma } from "@prisma/client";

import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { sendEmail, verifyEmailHtml } from "@/lib/email";
import { emailIdempotencyKey } from "@/services/email-outbox-policy";

// Credential signups must prove they control the address they registered
// with before they can sign in. OAuth is unaffected: Google has already
// verified the address, and the Prisma adapter stamps emailVerified at
// account link time.
//
// The gate itself lives in lib/auth.ts's credentials authorize().

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashVerificationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Issues a fresh verification token, invalidating any earlier one for the
 * same user so only the most recent link works.
 *
 * An upsert on the unique `userId`, not delete-then-insert: two overlapping
 * resend requests each deleting against their own snapshot would both
 * insert and leave two live tokens, which quietly breaks the "a new link
 * kills the old one" promise. The unique constraint makes that impossible
 * — the worst case is a losing writer retrying into an update.
 *
 * Only the hash is stored here, so this table can't be replayed to verify
 * an account. The raw link does live in the rendered body in email_outbox
 * while a retry could still need it — see EmailOutbox.sensitive for what
 * bounds that.
 */
export async function createEmailVerificationToken(
  userId: string,
  store: EmailVerificationStore = prismaStore,
) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  const record = await store.issue({ userId, tokenHash, expiresAt });

  // tokenHash, not record.id, is what identifies an *issuance*. Because
  // the write above is an upsert keyed on userId, the row id is stable for
  // the life of the account — using it as an idempotency key meant every
  // resend after the first collided with the first outbox row, so a failed
  // resend was never queued and a successful one was never recorded. The
  // hash changes with every token, which is exactly the granularity the
  // outbox needs.
  return {
    rawToken,
    tokenHash,
    tokenId: record.id,
    expiresAt: record.expiresAt,
  };
}

/**
 * Issues a token and emails the link. Never throws: a failure to send must
 * not roll back the registration that triggered it — the account exists,
 * the token exists, and the user can ask for the link again. The outbox
 * retries on its own.
 */
export async function sendVerificationEmail({
  userId,
  email,
}: {
  userId: string;
  email: string;
}): Promise<{ sent: boolean; queued: boolean }> {
  try {
    const { rawToken, tokenHash } = await createEmailVerificationToken(userId);

    const result = await sendEmail({
      to: email,
      subject: "Xác minh email Fgrapher của bạn",
      html: verifyEmailHtml({
        verifyUrl: appUrl(`/verify-email?token=${rawToken}`),
      }),
      // Scoped to the issued token, not to the user or the address: every
      // resend mints a new token and therefore a new key, so a legitimately
      // repeated request always sends. What this prevents is one token
      // being emailed twice if this path is somehow retried.
      //
      // The hash is no more sensitive here than the row already is — the
      // outbox stores the rendered email, which contains the raw link.
      idempotencyKey: emailIdempotencyKey("email-verification", tokenHash),
      // The body contains the raw verification link.
      sensitive: true,
    });

    return { sent: result.success, queued: result.queued };
  } catch (err) {
    console.error("[Email Verification] Failed to issue verification email", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, queued: false };
  }
}

export type VerifyEmailResult =
  | { status: "verified"; email: string }
  | { status: "already_verified"; email: string }
  | { status: "invalid" }
  | { status: "expired" };

interface TokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  user: { email: string; emailVerified: Date | null; deletedAt: Date | null };
}

/**
 * The three database operations verifyEmailToken needs, behind an
 * interface so the consume-once behaviour can be tested against two
 * genuinely interleaved callers without a live Postgres.
 */
export interface EmailVerificationStore {
  /**
   * Stores a newly issued token, replacing any existing one for the user.
   * Must keep at most one row per user — that invariant is what makes
   * "issuing a new link kills the old one" true.
   */
  issue(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string; expiresAt: Date }>;
  findByHash(tokenHash: string): Promise<TokenRecord | null>;
  /**
   * Deletes the token and marks the user verified in one transaction.
   * Returns false if the token was already gone — i.e. another request
   * consumed it first. MUST be atomic: the delete is what arbitrates the
   * race, so it has to be the thing that can only succeed once.
   */
  consume(tokenId: string, userId: string, verifiedAt: Date): Promise<boolean>;
  /** Discards a token without verifying anyone (expired, already done). */
  discard(tokenId: string): Promise<void>;
  /**
   * Current verification state, re-read after losing a consume race — the
   * only way to tell "someone else verified this account" from "the token
   * vanished for another reason".
   */
  getVerificationState(
    userId: string,
  ): Promise<{ emailVerified: Date | null } | null>;
}

const prismaStore: EmailVerificationStore = {
  issue: async ({ userId, tokenHash, expiresAt }) => {
    const write = () =>
      db.emailVerificationToken.upsert({
        where: { userId },
        create: { userId, tokenHash, expiresAt },
        update: { tokenHash, expiresAt, createdAt: new Date() },
        select: { id: true, expiresAt: true },
      });

    try {
      return await write();
    } catch (err) {
      // Prisma only compiles an upsert to a single INSERT … ON CONFLICT
      // when the shape allows it; otherwise it reads first and can lose a
      // race to a concurrent insert. Retrying resolves that against the
      // row that now exists.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return write();
      }
      throw err;
    }
  },

  findByHash: (tokenHash) =>
    db.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        user: {
          select: { email: true, emailVerified: true, deletedAt: true },
        },
      },
    }),

  consume: async (tokenId, userId, verifiedAt) =>
    db.$transaction(async (tx) => {
      // deleteMany, not delete: it reports how many rows it matched
      // instead of throwing, and under Postgres' READ COMMITTED a second
      // concurrent delete of the same row blocks until the first commits
      // and then matches nothing. Exactly one caller sees count === 1.
      const { count } = await tx.emailVerificationToken.deleteMany({
        where: { id: tokenId },
      });
      if (count !== 1) return false;

      await tx.user.update({
        where: { id: userId },
        data: { emailVerified: verifiedAt },
      });
      return true;
    }),

  discard: async (tokenId) => {
    await db.emailVerificationToken.deleteMany({ where: { id: tokenId } });
  },

  getVerificationState: (userId) =>
    db.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    }),
};

/**
 * Consumes a verification token. Single-use and replay-safe.
 *
 * The token is consumed by the delete itself rather than by a read
 * followed by a write, so two requests arriving together (a mail client
 * prefetching the link while the user also clicks it, a double-submit)
 * cannot both consume it. The loser doesn't get an error — the account is
 * verified either way, so it reports `already_verified`, which is the
 * truth from its point of view.
 *
 * `invalid` and `expired` say nothing about whether an account exists for
 * the address, so a guessed token can't be used to probe the user table.
 */
export async function verifyEmailToken(
  rawToken: string,
  store: EmailVerificationStore = prismaStore,
): Promise<VerifyEmailResult> {
  if (!rawToken) return { status: "invalid" };

  const record = await store.findByHash(hashVerificationToken(rawToken));

  if (!record || record.user.deletedAt) return { status: "invalid" };

  if (record.expiresAt.getTime() < Date.now()) {
    // Clear it out so a stale row can't linger; the user asks for a new one.
    await store.discard(record.id);
    return { status: "expired" };
  }

  if (record.user.emailVerified) {
    await store.discard(record.id);
    return { status: "already_verified", email: record.user.email };
  }

  const consumed = await store.consume(record.id, record.userId, new Date());

  if (consumed) return { status: "verified", email: record.user.email };

  // The token was gone by the time we tried to consume it. Usually that's
  // a concurrent request that verified the account a moment ago, and
  // reporting success is right. But it can also be the token disappearing
  // for an unrelated reason (an admin purge, a cascade), in which case
  // nobody verified anything — so re-read the state instead of assuming.
  // Claiming "already verified" for an account that is still unverified
  // would tell the user they can sign in when they can't.
  const state = await store.getVerificationState(record.userId);

  return state?.emailVerified
    ? { status: "already_verified", email: record.user.email }
    : { status: "invalid" };
}

/**
 * Re-issues a verification link. Returns nothing the caller can use to
 * tell whether the address is registered — the route reports the same
 * success either way, so this endpoint can't be used to enumerate accounts.
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  const normalized = email.trim();
  const select = {
    id: true,
    email: true,
    emailVerified: true,
    passwordHash: true,
    deletedAt: true,
    isSuspended: true,
  } as const;

  // Exact match first, because that's how registration stored it: nothing
  // in this codebase lowercases an address on the way in, so an account
  // created as "Bao@Example.com" is stored that way and looked up that way
  // at login. Only if that misses do we retry case-insensitively, so
  // someone typing their address in a different case still gets their
  // link. (Normalising addresses repo-wide is the real fix — it needs a
  // migration and a decision about existing rows, so it is deliberately
  // not smuggled in here.)
  const user =
    (await db.user.findUnique({ where: { email: normalized }, select })) ??
    (await db.user.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" } },
      select,
    }));

  // Nothing to do for an unknown address, an already-verified account, a
  // suspended or deleted one, or an OAuth-only account (which has no
  // password and was verified by the provider).
  if (
    !user ||
    user.deletedAt ||
    user.isSuspended ||
    user.emailVerified ||
    !user.passwordHash
  ) {
    return;
  }

  await sendVerificationEmail({ userId: user.id, email: user.email });
}
