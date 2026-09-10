import { Resend } from "resend";

import { env } from "@/lib/env";

// The single place that talks to Resend. Both the immediate send path
// (lib/email.ts's sendEmail) and the retry path (services/email-outbox.ts's
// processEmailOutbox) go through this — they previously each constructed
// their own Resend client with their own copy of the FROM address and the
// staging-redirect rule, which is exactly the kind of duplication that
// drifts (the retry path had already lost the recipient escaping the
// immediate path applied).

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS =
  process.env.EMAIL_FROM || "Fgrapher <noreply@fgrapher.com>";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@fgrapher.com";

export function getSupportEmail(): string {
  return SUPPORT_EMAIL;
}

export function isEmailConfigured(): boolean {
  return resend !== null;
}

export interface DeliverInput {
  to: string;
  subject: string;
  html: string;
}

export type DeliverResult =
  | { delivered: true; messageId?: string }
  | { delivered: false; error: string; retryable: boolean };

// Resend rejects these permanently — retrying just burns attempts and
// keeps a dead row cycling through the cron. Everything else (network
// blips, 5xx, rate limits) is worth another attempt.
const NON_RETRYABLE_PATTERNS = [
  /invalid.*(email|recipient|address|`to`)/i,
  /api key is invalid/i,
  /domain is not verified/i,
  /not authorized/i,
];

function isRetryable(message: string): boolean {
  return !NON_RETRYABLE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Hands one email to Resend. Never throws — every failure comes back as a
 * `delivered: false` result so the caller decides whether to queue, retry
 * or give up.
 *
 * On staging every email is redirected to a single test inbox rather than
 * the real recipient: real API key, fake destination, so staging exercises
 * the real Resend integration without ever emailing an actual user. Set
 * STAGING_TEST_INBOX to enable.
 */
export async function deliverEmail({
  to,
  subject,
  html,
}: DeliverInput): Promise<DeliverResult> {
  if (!resend) {
    return {
      delivered: false,
      error: "resend_not_configured",
      // No key means no key — another attempt in five minutes changes
      // nothing, but the row should stay queued rather than be burned,
      // so this is reported as retryable on purpose: once the key is
      // configured the backlog drains on the next cron run.
      retryable: true,
    };
  }

  const testInbox = process.env.STAGING_TEST_INBOX;
  const redirected = env.APP_ENV === "staging" && Boolean(testInbox);
  const recipient = redirected ? testInbox! : to;

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipient,
      // Plain text, not HTML — a subject line is never parsed as markup,
      // so escaping it here only mangles the address it's meant to show.
      subject: redirected ? `[staging → ${to}] ${subject}` : subject,
      html,
    });

    if (result.error) {
      const message = result.error.message || "unknown_provider_error";
      return {
        delivered: false,
        error: message,
        retryable: isRetryable(message),
      };
    }

    return { delivered: true, messageId: result.data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A thrown error is a transport-level fault (DNS, socket, timeout)
    // rather than a provider verdict — always worth retrying.
    return { delivered: false, error: message, retryable: true };
  }
}

/**
 * Logs a delivery failure. The recipient address is PII and is kept out of
 * production logs; in development it's included because knowing which
 * address failed is the whole point of the log locally.
 */
export function logEmailFailure(context: string, error: string, to: string) {
  if (env.NODE_ENV === "production") {
    console.error(`[Email] ${context}`, { error });
  } else {
    console.error(`[Email] ${context}`, { error, to });
  }
}
