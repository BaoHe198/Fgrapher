# Email Outbox & Retry Strategy

## Overview

Every transactional email goes through a database-backed outbox. The
outbox exists for two reasons: a provider outage must never turn a
successful mutation (a booking, a signup, a password reset) into an HTTP
500, and there must be a durable record of what the platform sent.

The table is a **complete ledger**, not a failure queue: emails delivered
on the first attempt are recorded too.

## Architecture

### `email_outbox`

| Column           | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `idempotencyKey` | Unique. **Event-scoped** — see below. Never a hash of the content. |
| `to`             | Recipient address                                                  |
| `subject`        | Subject line                                                       |
| `html`           | Body. **Nullable** — scrubbed once it can no longer be sent        |
| `sensitive`      | The body embeds a credential (see below)                           |
| `status`         | `PENDING` \| `SENDING` \| `SENT` \| `FAILED`                       |
| `attempts`       | Delivery attempts made (0–5)                                       |
| `nextAttemptAt`  | When to try next. **Null on terminal rows** (`SENT`/`FAILED`)      |
| `lockedAt`       | When the current `SENDING` claim was taken                         |
| `providerId`     | Resend message id, once delivered                                  |
| `lastError`      | Most recent error. Cleared on success                              |
| `sentAt`         | Delivery time (`SENT` only)                                        |

### Flow

1. **Immediate attempt** — `sendEmail()` hands the email to Resend.
   - Delivered → a `SENT` row is written (`attempts = 1`, `providerId`,
     `sentAt`) and the caller gets `{ success: true }`.
   - Permanently rejected (malformed address, unverified sending domain)
     → a `FAILED` row is written. Retrying cannot fix these, so no
     attempts are burned on them.
   - Temporarily failed → a `PENDING` row is queued and the caller gets
     `{ success: false, queued: true }`.
2. **Async retry** — the `/api/cron/email-retry` cron runs every 5 minutes,
   claims due rows one at a time and re-sends them.

`sendEmail()` never throws and never fails the caller's mutation. It does
report honestly: **`success || queued` means accepted.** Treat
`success: false, queued: true` as a normal outcome, not an error.

### Idempotency is event-scoped

`idempotencyKey` identifies **the event that caused the email**, e.g.
`email-verification:<tokenId>`. Build it with
`emailIdempotencyKey(scope, ...parts)` from
`src/services/email-outbox-policy.ts`.

It must never be derived from the message content. Two legitimately
distinct emails routinely read identically — a second booking reminder for
the same booking, the same contact-form message sent twice, a re-requested
verification link — and a content hash collapses them into one row. Since
that row is usually already `SENT`, the second email is dropped forever
rather than merely delayed.

**Omitting the key always sends.** An enqueue with no key gets a fresh
random one, so "no key" can never silently mean "deduplicate".

### Credential-bearing bodies

The outbox stores the _rendered_ email. Password-reset and
email-verification emails embed a live token in that body, so an outbox
that kept every body forever would be a durable store of working
account-takeover links — which would undo the point of hashing the token
in `email_verification_tokens`.

Callers that send such an email pass `sensitive: true`. For those rows:

- delivered on the first attempt → the body is **never written**;
- reaching a terminal state (`SENT`/`FAILED`) on retry → the body is
  **cleared** in the same update;
- queued for retry → the body **is stored**, because retrying needs it.

**Residual risk, stated plainly:** a credential-bearing body is readable in
the database for as long as the row is `PENDING` or `SENDING`. That window
is bounded by the retry budget (five attempts over ~15 minutes) and, past
that, by the token's own TTL — 1 hour for password reset, 24 hours for
email verification — after which the link is useless even if read. It is
not zero. Treat database backups of this table accordingly, and prefer
`sensitive` on any future email that carries a token.

Password reset has a second, pre-existing exposure this does not address:
`VerificationToken` stores its reset token in the clear. That is tracked
separately.

### Concurrency

`processEmailOutbox()` is safe to run concurrently. Each row is claimed
with a conditional `updateMany` that only matches while the row is still
`PENDING` and still due; the winner moves it to `SENDING` and increments
`attempts` in the same statement. A second overlapping run matches zero
rows and skips.

Rows stuck in `SENDING` for more than 10 minutes (a run killed mid-send,
a frozen lambda) are returned to `PENDING` at the start of the next run.

The attempt is counted at claim time, not after the send, so a process
that dies mid-delivery still burns an attempt — a poison message can't
loop forever.

## Backoff schedule

| Attempt | Wait before it | Cumulative |
| ------- | -------------- | ---------- |
| 1       | immediate      | 0          |
| 2       | 1 min          | 1 min      |
| 3       | 2 min          | 3 min      |
| 4       | 4 min          | 7 min      |
| 5       | 8 min          | 15 min     |

After 5 attempts the row is marked `FAILED` with `nextAttemptAt = NULL`.
The cron polls every 5 minutes, so real-world waits round up to the next
tick. The schedule lives in `getBackoffMs()` and is covered by
`src/services/__tests__/email-outbox-policy.test.ts`.

## Cron configuration

```json
{ "path": "/api/cron/email-retry", "schedule": "*/5 * * * *" }
```

Vercel Cron issues a **GET** and authenticates with an
**`Authorization: Bearer $CRON_SECRET`** header. There is no
`X-Cron-Secret` header and Vercel does not add one. The route uses the
shared `requireCronSecret()` helper, same as every other cron in
`vercel.json`.

Manual invocation:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/email-retry
```

Response:

```json
{
  "data": {
    "processed": 4,
    "sent": 3,
    "failed": 0,
    "requeued": 1,
    "reclaimed": 0,
    "skipped": 0,
    "stats": { "pending": 1, "sending": 0, "sent": 145, "failed": 2 }
  },
  "error": null,
  "message": null
}
```

## Operations

`to` and `status` are reserved words in Postgres — quote every identifier.

```sql
-- Queue health
SELECT "status", count(*) FROM "email_outbox" GROUP BY "status";

-- Most recent permanent failures
SELECT "id", "to", "subject", "lastError", "attempts", "createdAt"
FROM "email_outbox"
WHERE "status" = 'FAILED'
ORDER BY "updatedAt" DESC
LIMIT 20;

-- Claims that never completed (should be empty; recovered automatically
-- after 10 minutes)
SELECT "id", "to", "attempts", "lockedAt"
FROM "email_outbox"
WHERE "status" = 'SENDING' AND "lockedAt" < now() - interval '10 minutes';

-- Credential-bearing bodies still readable (should be small, short-lived)
SELECT "id", "to", "status", "attempts", "createdAt"
FROM "email_outbox"
WHERE "sensitive" AND "html" IS NOT NULL;

-- Did a specific signup's email go out?
SELECT "status", "attempts", "sentAt", "lastError"
FROM "email_outbox"
WHERE "idempotencyKey" LIKE 'email-verification:%'
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Manual retry

```sql
UPDATE "email_outbox"
SET "status" = 'PENDING', "attempts" = 0, "nextAttemptAt" = now(),
    "lockedAt" = NULL, "lastError" = NULL
WHERE "id" = '<email_id>';
```

### Cleanup

Bodies are stored in full, so the table grows with volume. Delivered rows
older than 90 days can go:

```sql
DELETE FROM "email_outbox"
WHERE "status" = 'SENT' AND "sentAt" < now() - interval '90 days';
```

There is no cron for this yet — see "Not done" below.

## Adding a call site

```ts
import { sendEmail } from "@/lib/email";
import { emailIdempotencyKey } from "@/services/email-outbox-policy";

const result = await sendEmail({
  to: user.email,
  subject: "…",
  html: someTemplate({ … }),
  // Only when the same event can fire this send twice:
  idempotencyKey: emailIdempotencyKey("booking-reminder", booking.id),
});

if (!result.success && !result.queued) {
  // Nothing will retry this. Rare — log it.
}
```

Pass `sensitive: true` whenever the body contains a token or a one-time
link.

`enqueueEmail()` from `@/services/email-outbox` skips the immediate
attempt and queues directly; use it for bulk background work where a
per-row round-trip to Resend inside the request isn't wanted.

## Troubleshooting

**Nothing is sending at all.** Check `RESEND_API_KEY` is set. Without it
`deliverEmail()` reports `resend_not_configured` as _retryable_ on
purpose: rows accumulate in `PENDING` and drain once the key is added,
rather than being burned.

**Rows sit in `PENDING` and `attempts` never rises.** The cron isn't
reaching the route. Verify `CRON_SECRET` is set in the Vercel project, and
check the cron log for 401s.

**`FAILED` at `attempts = 1`.** A permanent rejection. Read `lastError` —
usually an invalid recipient or an unverified sending domain.

## Not done

- No dashboard for viewing/retrying failed emails (SQL above is the tool).
- No Resend webhook, so bounces and complaints aren't reflected back into
  the table — a `SENT` row means "the provider accepted it", not "it
  reached the inbox".
- No retention cron for old `SENT` rows.
- No per-recipient rate limiting.
- **Never exercised against live Resend credentials** — same caveat as
  every other external integration in this repo (see CLAUDE.md).
