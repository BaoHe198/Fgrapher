import crypto from "crypto";

import { appUrl } from "@/lib/app-url";
import { resetPasswordEmailHtml, sendEmail } from "@/lib/email";
import {
  type CredentialStore,
  issueCredential,
  prismaCredentialStore,
} from "@/services/credential-email";
import { credentialEmailKey } from "@/services/email-outbox-policy";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

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
  const store = deps.store ?? prismaCredentialStore;
  const send = deps.send ?? sendEmail;
  const now = deps.now ?? Date.now;

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const { issuance } = await issueCredential(
      {
        type: "password-reset",
        userId,
        identifier: email,
        token,
        expires: new Date(now() + RESET_TOKEN_TTL_MS),
      },
      store,
    );

    const result = await send({
      to: email,
      // Vietnamese-first, matching resetPasswordEmailHtml's own copy
      // (CLAUDE.md rule 10).
      subject: "Đặt lại mật khẩu Fgrapher",
      // appUrl(), not `process.env.NEXTAUTH_URL` — that var is deliberately
      // unset on Vercel Preview (see lib/env.ts).
      html: resetPasswordEmailHtml({
        resetUrl: appUrl(`/reset-password?token=${token}`),
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
