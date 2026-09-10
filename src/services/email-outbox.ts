import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { deliverEmail, logEmailFailure } from "@/lib/email-transport";
import {
  MAX_ATTEMPTS,
  STALE_LOCK_MS,
  oneOffIdempotencyKey,
  resolveAttemptOutcome,
} from "@/services/email-outbox-policy";

// How many rows one cron invocation will work through. The route's
// maxDuration is 60s and each send is a network round-trip, so this is
// sized to finish comfortably inside it rather than to drain a backlog in
// one pass — the next run five minutes later picks up the rest.
const BATCH_SIZE = 25;

export interface OutboxEmailInput {
  to: string;
  subject: string;
  html: string;
  /**
   * The body embeds a credential (a password-reset or verification link).
   * Such a body is never written for an email delivered on the first
   * attempt, and is scrubbed as soon as the row reaches a terminal state.
   */
  sensitive?: boolean;
  /**
   * Event-scoped key (see emailIdempotencyKey). Omit for emails with no
   * natural event identity — a fresh random key is generated, so the
   * email always sends.
   */
  idempotencyKey?: string;
}

interface RecordedSend extends OutboxEmailInput {
  providerId?: string;
}

/**
 * Atomically claims an event before anything observable happens. The
 * `idempotencyKey` unique constraint is the arbiter: of N requests racing
 * to send the same event, exactly one `create` wins and the rest get
 * P2002 back as `{ reserved: false }`. The winner then delivers and
 * finalises the row (finalizeReservedEmail). This is what makes an
 * idempotent send race-safe without a check-then-send read that two
 * concurrent callers could both pass.
 *
 * The row starts SENDING with a lock held, so a crash between reserving
 * and finalising is recovered by the cron's stale-lock sweep rather than
 * stranding the event.
 */
export async function reserveEmail(
  payload: OutboxEmailInput & { idempotencyKey: string },
): Promise<{ reserved: true; id: string } | { reserved: false }> {
  try {
    const row = await db.emailOutbox.create({
      data: {
        idempotencyKey: payload.idempotencyKey,
        to: payload.to,
        subject: payload.subject,
        // Kept for now: a retryable failure leaves this row PENDING and the
        // cron needs the body. Scrubbed by finalizeReservedEmail once the
        // row reaches a terminal state, if it is sensitive.
        html: payload.html,
        sensitive: payload.sensitive ?? false,
        status: "SENDING",
        attempts: 1,
        lockedAt: new Date(),
        nextAttemptAt: null,
      },
      select: { id: true },
    });
    return { reserved: true, id: row.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { reserved: false };
    }
    throw err;
  }
}

/**
 * Rolling-window throttle for emails that would otherwise fire on every
 * occurrence of a high-frequency event (chat messages). "At most one email
 * per `scopeKey` per `windowMs`", measured against the actual last send —
 * NOT a wall-clock bucket, which lets two sends 90 seconds apart through
 * if they straddle a bucket edge.
 *
 * `withLock` serialises concurrent callers for the same `scopeKey` (a
 * Postgres advisory xact lock in production), so the "is there a recent
 * one?" check and the reservation insert are atomic as a pair: two
 * requests racing for the same conversation can't both find "nothing
 * recent" and both send.
 */
export interface ThrottleReservationOps {
  hasRecent(keyPrefix: string, since: Date): Promise<boolean>;
  create(row: {
    idempotencyKey: string;
    to: string;
    subject: string;
    html: string;
    sensitive: boolean;
  }): Promise<string>;
}

export interface ThrottleReservationStore {
  withLock<T>(
    lockKey: string,
    fn: (ops: ThrottleReservationOps) => Promise<T>,
  ): Promise<T>;
}

export async function reserveThrottledEmail(
  input: OutboxEmailInput & {
    scopeKey: string;
    windowMs: number;
    now?: Date;
  },
  store: ThrottleReservationStore,
): Promise<
  { reserved: true; id: string; idempotencyKey: string } | { reserved: false }
> {
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - input.windowMs);

  return store.withLock(input.scopeKey, async (ops) => {
    if (await ops.hasRecent(`${input.scopeKey}:`, since)) {
      return { reserved: false };
    }
    // A fresh key per send (the send time) so the outbox keeps one row per
    // email; the shared `scopeKey:` prefix is what the window query
    // matches on.
    const idempotencyKey = `${input.scopeKey}:${now.getTime()}`;
    const id = await ops.create({
      idempotencyKey,
      to: input.to,
      subject: input.subject,
      html: input.html,
      sensitive: input.sensitive ?? false,
    });
    return { reserved: true, id, idempotencyKey };
  });
}

export const prismaThrottleReservationStore: ThrottleReservationStore = {
  withLock(lockKey, fn) {
    return db.$transaction(async (tx) => {
      // Advisory lock is transaction-scoped: released automatically on
      // COMMIT/ROLLBACK. hashtextextended maps the key to the bigint the
      // lock function wants.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      return fn({
        hasRecent: (keyPrefix, since) =>
          tx.emailOutbox
            .findFirst({
              where: {
                idempotencyKey: { startsWith: keyPrefix },
                createdAt: { gt: since },
              },
              select: { id: true },
            })
            .then((row) => row !== null),
        create: (row) =>
          tx.emailOutbox
            .create({
              data: {
                idempotencyKey: row.idempotencyKey,
                to: row.to,
                subject: row.subject,
                html: row.html,
                sensitive: row.sensitive,
                status: "SENDING",
                attempts: 1,
                lockedAt: new Date(),
                nextAttemptAt: null,
              },
              select: { id: true },
            })
            .then((created) => created.id),
      });
    });
  },
};

/**
 * Resolves a row reserved by reserveEmail() to its terminal (or, for a
 * retryable failure, next-attempt) state. Mirrors the per-row update in
 * processEmailOutbox so the immediate and retry paths converge.
 */
export async function finalizeReservedEmail({
  id,
  sensitive,
  delivery,
}: {
  id: string;
  sensitive: boolean;
  delivery:
    | { delivered: true; messageId?: string }
    | { delivered: false; error: string; retryable: boolean };
}): Promise<void> {
  const outcome = resolveAttemptOutcome({
    attempts: 1,
    error: delivery.delivered ? undefined : delivery.error,
    retryable: delivery.delivered ? undefined : delivery.retryable,
  });
  const isTerminal = outcome.status === "SENT" || outcome.status === "FAILED";

  await db.emailOutbox.update({
    where: { id },
    data: {
      status: outcome.status,
      nextAttemptAt: outcome.nextAttemptAt,
      sentAt: outcome.sentAt,
      lockedAt: null,
      ...(sensitive && isTerminal ? { html: null } : {}),
      providerId: delivery.delivered ? (delivery.messageId ?? null) : null,
      lastError: delivery.delivered ? null : delivery.error,
    },
  });
}

/**
 * Writes a terminal row without queueing a retry. Shared by the two
 * immediate-path outcomes that must still be recorded: a first-attempt
 * success, and a permanent rejection that retrying can't fix.
 */
async function recordTerminal(
  payload: OutboxEmailInput,
  fields: Pick<
    Prisma.EmailOutboxCreateInput,
    "status" | "sentAt" | "providerId" | "lastError"
  >,
): Promise<string | null> {
  try {
    const row = await db.emailOutbox.create({
      data: {
        idempotencyKey: payload.idempotencyKey ?? oneOffIdempotencyKey(),
        to: payload.to,
        subject: payload.subject,
        // A terminal row is never sent again, so a credential-bearing body
        // has no reason to be written at all. The ledger keeps recipient,
        // subject, status and provider id, which is what it exists for.
        html: payload.sensitive ? null : payload.html,
        sensitive: payload.sensitive ?? false,
        attempts: 1,
        nextAttemptAt: null,
        ...fields,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Already recorded for this event.
      return null;
    }
    throw err;
  }
}

/**
 * Queues an email for delivery by the retry cron. Returns the row id, or
 * null if an identical event was already queued (or already sent).
 *
 * Deliberately create-and-catch rather than upsert: an upsert resurrects
 * rows, and the row a duplicate key collides with is usually already SENT.
 * The original reset only `nextAttemptAt` on conflict and left `status`
 * alone, so a duplicate landing on a SENT row produced a schedule the
 * processor — which only selects PENDING — would never act on. The email
 * was neither re-sent nor reported as skipped.
 */
export async function enqueueEmail(
  payload: OutboxEmailInput,
): Promise<string | null> {
  const idempotencyKey = payload.idempotencyKey ?? oneOffIdempotencyKey();

  try {
    const row = await db.emailOutbox.create({
      data: {
        idempotencyKey,
        to: payload.to,
        subject: payload.subject,
        // Kept, because retrying needs it. This is the residual exposure
        // window for a credential-bearing email — bounded by the retry
        // budget and by the token's own TTL. See docs/ops/email-outbox.md.
        html: payload.html,
        sensitive: payload.sensitive ?? false,
        status: "PENDING",
        nextAttemptAt: new Date(),
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Already queued or already delivered for this event — that's the
      // entire point of supplying a key.
      return null;
    }
    throw err;
  }
}

/**
 * Records an email that was already delivered on the immediate path, so
 * the outbox is a complete ledger of what the platform sent rather than
 * only of what failed. Without this there's no way to answer "did the
 * verification email for this signup actually go out?" from the database.
 */
export async function recordSentEmail(
  payload: RecordedSend,
): Promise<string | null> {
  return recordTerminal(payload, {
    status: "SENT",
    sentAt: new Date(),
    providerId: payload.providerId ?? null,
  });
}

/**
 * Records an email the provider rejected permanently (malformed address,
 * unverified sending domain). Retrying can't fix those, so the row goes
 * straight to FAILED rather than cycling through the cron five times — but
 * it is still written, so the failure is visible in the outbox instead of
 * existing only in a log line.
 */
export async function recordFailedEmail(
  payload: OutboxEmailInput & { error: string },
): Promise<string | null> {
  return recordTerminal(payload, {
    status: "FAILED",
    lastError: payload.error,
  });
}

/**
 * Returns SENDING rows whose lock has gone stale to PENDING. A run that
 * dies between claiming a row and recording the outcome (deploy mid-run,
 * lambda timeout, OOM) would otherwise strand that email in SENDING
 * forever, since the processor only ever selects PENDING.
 */
async function reclaimStaleLocks(now: Date): Promise<number> {
  const { count } = await db.emailOutbox.updateMany({
    where: {
      status: "SENDING",
      lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) },
    },
    data: { status: "PENDING", nextAttemptAt: now, lockedAt: null },
  });
  return count;
}

export interface ProcessOutboxResult {
  processed: number;
  sent: number;
  failed: number;
  requeued: number;
  reclaimed: number;
  skipped: number;
}

/**
 * Drains due emails from the outbox. Safe to run concurrently: each row is
 * claimed with a conditional updateMany that only matches while the row is
 * still PENDING and due, so of two overlapping runs exactly one wins the
 * claim and the other skips the row. The original selected rows and then
 * sent them with no claim at all, so two cron invocations overlapping —
 * a manual trigger, a Vercel retry, or simply a run outliving its five
 * minute interval — delivered every due email twice.
 */
export async function processEmailOutbox(): Promise<ProcessOutboxResult> {
  const startedAt = new Date();
  const reclaimed = await reclaimStaleLocks(startedAt);

  const due = await db.emailOutbox.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: startedAt },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });

  const result: ProcessOutboxResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    requeued: 0,
    reclaimed,
    skipped: 0,
  };

  for (const { id } of due) {
    // Claim: only succeeds while the row is still PENDING and still due.
    // The attempt is counted here, not after the send, so a crash between
    // claiming and recording still burns an attempt — a poison message
    // can't loop forever once stale-lock recovery returns it to PENDING.
    const claim = await db.emailOutbox.updateMany({
      where: {
        id,
        status: "PENDING",
        nextAttemptAt: { lte: startedAt },
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: {
        status: "SENDING",
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    if (claim.count !== 1) {
      // Another concurrent run took it.
      result.skipped += 1;
      continue;
    }

    // Each row is isolated: one row's provider or database error must not
    // abort the batch. The original loop had no per-row guard, so a throw
    // skipped every remaining email *and* left the row it was working on
    // unrecorded — which meant a successfully sent email got sent again on
    // the next run.
    try {
      const email = await db.emailOutbox.findUnique({
        where: { id },
        select: {
          to: true,
          subject: true,
          html: true,
          attempts: true,
          sensitive: true,
          idempotencyKey: true,
        },
      });
      if (!email) {
        result.skipped += 1;
        continue;
      }

      // A scrubbed body can never be sent. That only happens if a row was
      // somehow returned to PENDING after reaching a terminal state, so
      // fail it outright rather than looping on an empty email.
      if (email.html === null) {
        await db.emailOutbox.update({
          where: { id },
          data: {
            status: "FAILED",
            nextAttemptAt: null,
            lockedAt: null,
            lastError: "body_unavailable",
          },
        });
        result.processed += 1;
        result.failed += 1;
        continue;
      }

      const delivery = await deliverEmail({
        to: email.to,
        subject: email.subject,
        html: email.html,
        // Carry the same key to Resend so a row that was actually
        // delivered but not finalized here (crash between send and update)
        // is not re-sent when the stale-lock sweep requeues it.
        idempotencyKey: email.idempotencyKey,
      });

      const outcome = resolveAttemptOutcome({
        attempts: email.attempts,
        error: delivery.delivered ? undefined : delivery.error,
        retryable: delivery.delivered ? undefined : delivery.retryable,
      });

      const isTerminal =
        outcome.status === "SENT" || outcome.status === "FAILED";

      await db.emailOutbox.update({
        where: { id },
        data: {
          status: outcome.status,
          nextAttemptAt: outcome.nextAttemptAt,
          sentAt: outcome.sentAt,
          lockedAt: null,
          // Scrub the credential the moment it can no longer be needed for
          // a retry, so a durable queue doesn't become a durable store of
          // live reset/verification links.
          ...(email.sensitive && isTerminal ? { html: null } : {}),
          providerId: delivery.delivered ? (delivery.messageId ?? null) : null,
          // Cleared on success so a row that eventually delivered doesn't
          // keep reading as broken.
          lastError: delivery.delivered ? null : delivery.error,
        },
      });

      result.processed += 1;
      if (outcome.status === "SENT") result.sent += 1;
      else if (outcome.status === "FAILED") result.failed += 1;
      else result.requeued += 1;

      if (!delivery.delivered) {
        logEmailFailure("outbox attempt failed", delivery.error, email.to);
      }
    } catch (err) {
      // Release the claim so the row is retried rather than stranded in
      // SENDING until stale-lock recovery notices it.
      const message = err instanceof Error ? err.message : String(err);
      logEmailFailure("outbox row errored", message, "");
      await db.emailOutbox
        .updateMany({
          where: { id, status: "SENDING" },
          data: {
            status: "PENDING",
            lockedAt: null,
            nextAttemptAt: new Date(),
          },
        })
        .catch(() => {
          // Nothing further to do — stale-lock recovery will pick it up.
        });
      result.requeued += 1;
    }
  }

  return result;
}

export async function getEmailOutboxStats() {
  const [pending, sending, sent, failed] = await Promise.all([
    db.emailOutbox.count({ where: { status: "PENDING" } }),
    db.emailOutbox.count({ where: { status: "SENDING" } }),
    db.emailOutbox.count({ where: { status: "SENT" } }),
    db.emailOutbox.count({ where: { status: "FAILED" } }),
  ]);

  return { pending, sending, sent, failed };
}
