import {
  deliverEmail,
  getSupportEmail,
  logEmailFailure,
} from "@/lib/email-transport";
import {
  enqueueEmail,
  finalizeReservedEmail,
  prismaThrottleReservationStore,
  recordFailedEmail,
  recordSentEmail,
  reserveEmail,
  reserveThrottledEmail,
} from "@/services/email-outbox";

// The templates themselves live in lib/email-templates.ts (pure, no env/db,
// unit-testable). Re-exported here so every existing
// `import { bookingRequestEmailHtml } from "@/lib/email"` keeps working.
export * from "@/lib/email-templates";
export { getSupportEmail };

export interface SendEmailResult {
  /** The provider accepted the email on this request. */
  success: boolean;
  /**
   * The email is durably stored in the outbox and the retry cron will keep
   * trying. `success: false, queued: true` is a normal, non-error outcome —
   * callers should treat it as accepted.
   */
  queued: boolean;
  error?: string;
  messageId?: string;
  outboxId?: string;
  /**
   * An email with the same idempotency key was already reserved or sent by
   * another call, so this one sent nothing. Treated as accepted — the
   * original owns delivery.
   */
  deduped?: boolean;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /**
   * Event-scoped idempotency key (see services/email-outbox-policy.ts's
   * emailIdempotencyKey). Supply one when the *same event* may legitimately
   * trigger this send more than once and should only produce one email.
   * Omit it when every call is a distinct email the user asked for — a
   * resent verification link, a second contact-form message — because an
   * omitted key always sends.
   */
  idempotencyKey?: string;
  /**
   * The body embeds a credential — a password-reset or email-verification
   * link. Set it and the outbox keeps the body only for as long as a retry
   * could still need it (see EmailOutbox.sensitive).
   */
  sensitive?: boolean;
  /**
   * Rolling-window throttle: at most one email per `scopeKey` per
   * `windowMs`, enforced atomically (see reserveThrottledEmail). Takes
   * precedence over `idempotencyKey` when both are set. Used for
   * NEW_MESSAGE (`scopeKey` = conversation + recipient).
   */
  throttle?: { scopeKey: string; windowMs: number };
}

/**
 * Sends one transactional email.
 *
 * Never throws and never fails the caller's mutation: a booking that was
 * created successfully must not turn into an HTTP 500 because Resend was
 * briefly unreachable. What it does *not* do is claim success it didn't
 * have — the previous version returned `{ success: true }` unconditionally,
 * which made the `if (!result.success)` branches in the contact and
 * password-reset routes permanently dead code and left callers unable to
 * tell "delivered" from "silently dropped". Check `success || queued` to
 * mean "accepted".
 *
 * Every outcome is recorded in the outbox — delivered on the first attempt
 * included — so the table is a complete ledger of what the platform sent,
 * not just of what broke.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  // A throttle or an event-scoped key means "at most one email for this
  // event/window". Both reserve the outbox row *before* delivering, so two
  // concurrent callers can't both pass a check and both send.
  if (input.throttle || input.idempotencyKey) {
    return sendReservedEmail(input);
  }
  return sendUnkeyedEmail(input);
}

async function sendReservedEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const { to, subject, html, idempotencyKey, sensitive, throttle } = input;

  let reservation:
    | { reserved: true; id: string; idempotencyKey: string }
    | { reserved: false };
  try {
    if (throttle) {
      reservation = await reserveThrottledEmail(
        {
          to,
          subject,
          html,
          sensitive,
          scopeKey: throttle.scopeKey,
          windowMs: throttle.windowMs,
        },
        prismaThrottleReservationStore,
      );
    } else {
      const r = await reserveEmail({
        to,
        subject,
        html,
        idempotencyKey: idempotencyKey!,
        sensitive,
      });
      reservation = r.reserved
        ? { reserved: true, id: r.id, idempotencyKey: idempotencyKey! }
        : { reserved: false };
    }
  } catch (err) {
    // The reserve write itself failed (DB down / lock contention). Do NOT
    // fall back to an unkeyed send — that would defeat the very
    // idempotency the caller asked for. Report it as not accepted; the
    // caller's mutation is unaffected, and (for a throttled or retryable
    // event) the next occurrence tries again.
    const message = err instanceof Error ? err.message : String(err);
    logEmailFailure("outbox reserve failed", message, to);
    return { success: false, queued: false, error: "reserve_failed" };
  }

  if (!reservation.reserved) {
    return { success: true, queued: false, deduped: true };
  }

  const outboxId = reservation.id;
  const delivery = await deliverEmail({
    to,
    subject,
    html,
    idempotencyKey: reservation.idempotencyKey,
  });

  await safeRecord(async () => {
    await finalizeReservedEmail({
      id: outboxId,
      sensitive: sensitive ?? false,
      delivery,
    });
    return outboxId;
  });

  if (delivery.delivered) {
    return {
      success: true,
      queued: false,
      messageId: delivery.messageId,
      outboxId,
    };
  }

  logEmailFailure("immediate send failed", delivery.error, to);
  return {
    success: false,
    // Retryable failures leave the row PENDING for the cron; a permanent
    // rejection was written FAILED by finalizeReservedEmail.
    queued: delivery.retryable,
    error: delivery.error,
    outboxId,
  };
}

async function sendUnkeyedEmail({
  to,
  subject,
  html,
  idempotencyKey,
  sensitive,
}: SendEmailInput): Promise<SendEmailResult> {
  const delivery = await deliverEmail({ to, subject, html });

  if (delivery.delivered) {
    const outboxId = await safeRecord(() =>
      recordSentEmail({
        to,
        subject,
        html,
        idempotencyKey,
        sensitive,
        providerId: delivery.messageId,
      }),
    );
    return {
      success: true,
      queued: false,
      messageId: delivery.messageId,
      ...(outboxId ? { outboxId } : {}),
    };
  }

  logEmailFailure("immediate send failed", delivery.error, to);

  if (!delivery.retryable) {
    const outboxId = await safeRecord(() =>
      recordFailedEmail({
        to,
        subject,
        html,
        idempotencyKey,
        sensitive,
        error: delivery.error,
      }),
    );
    return {
      success: false,
      queued: false,
      error: delivery.error,
      ...(outboxId ? { outboxId } : {}),
    };
  }

  const outboxId = await safeRecord(() =>
    enqueueEmail({ to, subject, html, idempotencyKey, sensitive }),
  );

  return {
    success: false,
    // No outbox row means nothing will retry — say so, rather than implying
    // the email is safely queued when it isn't.
    queued: outboxId !== null,
    error: delivery.error,
    ...(outboxId ? { outboxId } : {}),
  };
}

// The outbox write is awaited, not fire-and-forget. The original kicked off
// the enqueue without awaiting it, which on a serverless runtime is a data
// loss bug: the handler returns, the instance is frozen, and the pending
// insert never runs — the email is gone with nothing recording it was ever
// attempted. It's a single indexed insert, so awaiting it is cheap.
async function safeRecord(
  write: () => Promise<string | null>,
): Promise<string | null> {
  try {
    return await write();
  } catch (err) {
    // The outbox is a reliability mechanism, not a reason to fail the
    // caller's mutation — if even the queue write fails, log and move on.
    const message = err instanceof Error ? err.message : String(err);
    logEmailFailure("outbox write failed", message, "");
    return null;
  }
}

// Every other export in this file is transactional — booking status
// changes, password resets, orders, reviews, subscription billing events
// — tied to a specific transaction the recipient is a party to, so none
// of them require ConsentPurpose.MARKETING (see services/compliance.ts).
// Promotional content (product updates, tips, newsletters) must go
// through this wrapper instead of calling sendEmail directly, so the
// consent check can't be silently skipped by a future call site. The
// caller resolves hasConsent(userId, "MARKETING") itself — this file
// stays a thin transport and doesn't reach into the services layer.
export async function sendMarketingEmail({
  to,
  subject,
  html,
  idempotencyKey,
  hasMarketingConsent,
}: SendEmailInput & {
  hasMarketingConsent: boolean;
}): Promise<SendEmailResult> {
  if (!hasMarketingConsent) {
    return {
      success: false,
      queued: false,
      error: "marketing_consent_not_given",
    };
  }
  // Marketing email never carries a credential, so no `sensitive`.
  return sendEmail({ to, subject, html, idempotencyKey });
}
