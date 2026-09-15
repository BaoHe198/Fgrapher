import bcrypt from "bcryptjs";
import crypto from "crypto";

import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { resetPasswordEmailHtml, sendEmail } from "@/lib/email";
import {
  type CredentialStore,
  hashCredentialToken,
  issueCredential,
  prismaCredentialStore,
  storedResetToken,
} from "@/services/credential-email";
import {
  type CredentialIssuance,
  credentialEmailKey,
} from "@/services/email-outbox-policy";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Mints a reset token for an account and makes it the live one. Only its
 * hash is stored (see resetTokenRowData); the raw token is returned for the
 * link and exists nowhere else.
 */
export async function issuePasswordResetToken(
  { userId, email }: { userId: string; email: string },
  deps: { store?: CredentialStore; now?: () => number } = {},
): Promise<{ rawToken: string; issuance: CredentialIssuance }> {
  const store = deps.store ?? prismaCredentialStore;
  const now = deps.now ?? Date.now;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const { issuance } = await issueCredential(
    {
      type: "password-reset",
      userId,
      identifier: email,
      tokenHash: hashCredentialToken(rawToken),
      expires: new Date(now() + RESET_TOKEN_TTL_MS),
    },
    store,
  );
  return { rawToken, issuance };
}

/**
 * Issues a password-reset token for an existing account and emails the link.
 *
 * Never throws. The forgot-password route calls this only when the address
 * belongs to an account and must answer identically either way; if a
 * database or delivery failure here surfaced as a 500, that 500 would only
 * ever happen for registered addresses — an enumeration signal. Failures
 * are logged instead.
 *
 * Issuance goes through issueCredential, under the per-account lock: the old
 * token is replaced and any retry still queued for an older reset link is
 * cancelled in the same transaction. The email carries a credential key, so
 * a failed attempt is only re-queued while this link is still the live one.
 * Before this, two concurrent requests could each delete and then each
 * create, leaving two live reset tokens, and an older link's queued retry
 * could be delivered after a newer link.
 */
export async function sendPasswordResetEmail(
  { userId, email }: { userId: string; email: string },
  deps: {
    store?: CredentialStore;
    send?: typeof sendEmail;
    now?: () => number;
  } = {},
): Promise<{ accepted: boolean }> {
  const send = deps.send ?? sendEmail;

  try {
    const { rawToken, issuance } = await issuePasswordResetToken(
      { userId, email },
      deps,
    );

    const result = await send({
      to: email,
      // Vietnamese-first, matching resetPasswordEmailHtml's own copy
      // (CLAUDE.md rule 10).
      subject: "Đặt lại mật khẩu Fgrapher",
      // appUrl(), not `process.env.NEXTAUTH_URL` — that var is deliberately
      // unset on Vercel Preview (see lib/env.ts).
      html: resetPasswordEmailHtml({
        resetUrl: appUrl(`/reset-password?token=${rawToken}`),
      }),
      // The body contains the raw reset link.
      sensitive: true,
      // Keyed per issuance (a hash of this token — never the token itself,
      // since keys outlive the scrubbed body). A second reset request mints
      // a new token and so a new key, so repeat requests still always send.
      idempotencyKey: credentialEmailKey(issuance),
    });

    if (!result.success && !result.queued) {
      console.error("[Password Reset] Email send failed", {
        error: result.error,
      });
    }
    return { accepted: result.success || result.queued };
  } catch (err) {
    console.error("[Password Reset] Failed to issue reset link", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { accepted: false };
  }
}

// --- Completing a reset ----------------------------------------------------

/**
 * The shape every reset token has ever been minted in (32 random bytes,
 * hex). Only a submission in this shape is looked up raw, which is what
 * keeps the legacy fallback from matching a hashed row: a stored value is
 * `sha256:…` and can never equal bare hex.
 */
const RAW_RESET_TOKEN = /^[0-9a-f]{64}$/;

interface StoredResetToken {
  identifier: string;
  token: string;
  expires: Date;
}

/**
 * The two database operations completion needs, behind an interface so
 * one-time use can be tested against genuinely interleaved callers without
 * a live Postgres.
 */
export interface PasswordResetCompletionStore {
  /** The row whose VerificationToken.token is exactly `storedToken`. */
  find(storedToken: string): Promise<StoredResetToken | null>;
  /**
   * Deletes the row — only if it is still there and unexpired at `now` —
   * and sets the account's password, in one transaction. Returns false if
   * nothing was deleted. MUST be atomic: the delete is what arbitrates
   * concurrent completions, so it has to be the thing that succeeds once.
   */
  consume(input: {
    storedToken: string;
    identifier: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean>;
}

export const prismaPasswordResetCompletionStore: PasswordResetCompletionStore =
  {
    find: (storedToken) =>
      db.verificationToken.findUnique({ where: { token: storedToken } }),

    consume: ({ storedToken, identifier, passwordHash, now }) =>
      db.$transaction(async (tx) => {
        // deleteMany, not delete: under READ COMMITTED a second concurrent
        // delete of the same row blocks until the first commits and then
        // matches nothing, so exactly one caller sees count === 1. (The
        // old `delete` made the loser throw — a 500 instead of "invalid".)
        // The expiry filter re-checks after the slow bcrypt hash.
        const { count } = await tx.verificationToken.deleteMany({
          where: { token: storedToken, identifier, expires: { gte: now } },
        });
        if (count !== 1) return false;

        // A changed password kills every other outstanding reset link for
        // the address. Normally there is at most one; rows from before
        // issuance was serialised (including legacy raw rows) may not be.
        await tx.verificationToken.deleteMany({ where: { identifier } });
        await tx.user.update({
          where: { email: identifier },
          data: { passwordHash },
        });
        return true;
      }),
  };

export type CompletePasswordResetResult =
  { status: "updated" } | { status: "invalid" };

/**
 * Sets a new password with a reset token. Single-use and replay-safe.
 *
 * Unknown, expired, already-used and malformed tokens all come back as the
 * same `invalid`, which says nothing about whether an account exists.
 */
export async function completePasswordReset(
  { rawToken, password }: { rawToken: string; password: string },
  deps: {
    store?: PasswordResetCompletionStore;
    hashPassword?: (password: string) => Promise<string>;
    now?: () => Date;
  } = {},
): Promise<CompletePasswordResetResult> {
  const store = deps.store ?? prismaPasswordResetCompletionStore;
  const hashPassword =
    deps.hashPassword ?? ((plain: string) => bcrypt.hash(plain, 12));
  const now = deps.now ?? (() => new Date());

  if (!rawToken) return { status: "invalid" };

  let record = await store.find(
    storedResetToken(hashCredentialToken(rawToken)),
  );

  // LEGACY: links emailed before tokens were hashed are stored raw. Remove
  // this fallback once hashing has been deployed for RESET_TOKEN_TTL_MS —
  // no legacy row can pass the expiry check after that.
  if (!record && RAW_RESET_TOKEN.test(rawToken)) {
    record = await store.find(rawToken);
  }

  if (!record || record.expires < now()) return { status: "invalid" };

  const passwordHash = await hashPassword(password);
  const consumed = await store.consume({
    storedToken: record.token,
    identifier: record.identifier,
    passwordHash,
    now: now(),
  });

  return consumed ? { status: "updated" } : { status: "invalid" };
}
