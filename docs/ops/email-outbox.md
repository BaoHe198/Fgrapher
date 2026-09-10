# Email Outbox & Retry Strategy

## Overview

The email delivery system uses a database-backed outbox pattern to ensure reliable delivery while preventing HTTP 500 errors for mutations that trigger emails. Failures are automatically retried with exponential backoff.

## Architecture

### Tables

**`email_outbox`**: DB-backed queue for all transactional emails

- `idempotencyKey` (unique): SHA256 hash of (recipient + subject + body) — prevents duplicate sends if the same email is requested multiple times
- `to`: recipient email address
- `subject`: email subject
- `html`: email body (HTML)
- `status`: PENDING | SENT | FAILED
- `attempts`: retry count (0-5)
- `nextAttemptAt`: when to try next (exponential backoff)
- `providerId`: Resend message ID (once sent successfully)
- `lastError`: most recent error message
- `createdAt`: when queued
- `sentAt`: when successfully delivered (SENT status only)

### Flow

1. **Immediate attempt**: `sendEmail()` tries to send via Resend immediately
   - If successful → return success to caller, no outbox entry
   - If fails → insert into outbox, return success to caller (never 500)
2. **Async retry**: Cron job `/api/cron/email-retry` runs every 5 minutes
   - Fetches all PENDING emails where `nextAttemptAt <= now`
   - Attempts send up to 5 times total
   - On failure: backoff = 1m, 2m, 4m, 8m, then 24h wait (or mark FAILED)
   - On success: mark SENT, populate `providerId`, populate `sentAt`

### Guarantees

- **Idempotency**: Same email (same recipient + subject + body) queued multiple times → only sends once
- **Reliability**: Sends up to 5 times over ~15 minutes before giving up
- **No HTTP errors**: Email send failures never cause 500 responses for bookings/messages/payments
- **Production visibility**: Failed emails logged without PII (no recipient in production logs)

## Operations

### Monitoring

Query the outbox for pending/failed emails:

```sql
-- Pending emails waiting for retry
SELECT count(*), status
FROM email_outbox
GROUP BY status;

-- Most recent failures
SELECT id, to, subject, lastError, attempts, createdAt
FROM email_outbox
WHERE status = 'FAILED'
ORDER BY updatedAt DESC
LIMIT 20;

-- Emails stuck in retry loop
SELECT id, to, subject, attempts, nextAttemptAt, lastError
FROM email_outbox
WHERE status = 'PENDING'
  AND attempts >= 4
  AND nextAttemptAt < now()
ORDER BY createdAt DESC;
```

### Manual Retry

If an email is stuck in FAILED status, manually retry it:

```sql
-- Clear failure and reset for retry
UPDATE email_outbox
SET status = 'PENDING', attempts = 0, nextAttemptAt = now()
WHERE id = '<email_id>';
```

### Cleanup

Old sent emails (older than 90 days) can be deleted:

```sql
DELETE FROM email_outbox
WHERE status = 'SENT'
  AND sentAt < now() - interval '90 days';
```

## Cron Configuration

In `vercel.json`, the email retry cron is configured as:

```json
{
  "path": "/api/cron/email-retry",
  "schedule": "*/5 * * * *"
}
```

This runs every 5 minutes. Authentication is via `X-Cron-Secret` header (Vercel automatically adds this using `CRON_SECRET` env var).

### Health Check

The cron endpoint returns:

```json
{
  "success": true,
  "message": "Email retry cron completed",
  "stats": {
    "pending": 3,
    "sent": 145,
    "failed": 2
  }
}
```

Monitor with Vercel's cron dashboard or Sentry if configured.

## API Integration

### For callers

No change needed. `sendEmail()` still returns `{ success: boolean; error?: string; messageId?: string }` for immediate requests, but now **always returns true** (email failures don't propagate).

```typescript
// Old behavior: could fail on send error
// const result = await sendEmail({ ... });
// if (!result.success) { /* handle error */ }

// New behavior: failures are queued for retry, always success
const result = await sendEmail({ ... });
// result.success === true (always)
```

### Adding emails to the outbox directly

Use `enqueueEmail()` for background jobs that don't need immediate send:

```typescript
import { enqueueEmail } from "@/services/email-outbox";

await enqueueEmail({
  to: "user@example.com",
  subject: "Invoice",
  html: "<p>Your invoice is ready</p>",
});
```

This skips the immediate send attempt and queues directly.

## Backoff Schedule

Attempts are retried with exponential backoff:

| Attempt | Delay | Cumulative Time |
| ------- | ----- | --------------- |
| 1       | 1 min | 1 min           |
| 2       | 2 min | 3 min           |
| 3       | 4 min | 7 min           |
| 4       | 8 min | 15 min          |
| 5       | 24h   | ~24h            |

If all 5 attempts fail, the email is marked `FAILED` and waits in the database. Manual intervention (or a dashboard) is needed to retry.

## Testing

Unit tests for idempotency and backoff:

```bash
npx tsx src/services/__tests__/email-outbox.test.ts
```

E2E test: trigger a booking email and verify it's enqueued and sent.

## Troubleshooting

### Email not sending

1. Check outbox status: `SELECT * FROM email_outbox WHERE to = 'user@example.com' ORDER BY createdAt DESC LIMIT 1;`
2. If PENDING → cron hasn't run yet or is failing
3. If FAILED → check `lastError` column
4. Verify `CRON_SECRET` is set in production env vars
5. Check Vercel cron logs for `/api/cron/email-retry` failures

### Duplicate emails

Should be impossible due to idempotency key uniqueness. If suspected:

```sql
SELECT idempotencyKey, count(*)
FROM email_outbox
GROUP BY idempotencyKey
HAVING count(*) > 1;
```

Contact support if this query returns rows.

### High retry volume

If `nextAttemptAt` keeps drifting forward (7+ attempt cycles), the email is likely undeliverable:

- Verify recipient email is valid
- Check Resend error logs
- Consider manually marking as FAILED

## Future Improvements

- [ ] Dashboard UI to view/retry/delete failed emails
- [ ] Webhooks from Resend to mark bounced/complained emails
- [ ] Rate limiting per recipient (don't spam failed addresses)
- [ ] Bulk deletion/archival of old sent emails
