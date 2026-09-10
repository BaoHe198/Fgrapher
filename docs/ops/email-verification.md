# Email verification (credential signups)

An account created with an email and password must prove it controls that
address before it can sign in. OAuth signups are unaffected: Google has
already verified the address and the Prisma adapter stamps
`users.emailVerified` when the account is linked.

## The gate

`src/lib/auth.ts`, credentials `authorize()`:

```
password verified?  ──no──▶ null → "wrong email or password"
        │yes
emailVerified set?  ──no──▶ throw EmailNotVerifiedError
        │yes                  → /login?error=CredentialsSignin
      sign in                          &code=email_not_verified
```

The unverified check runs **after** `bcrypt.compare`, so the distinct error
is only ever shown to someone who already holds valid credentials for that
account. It therefore leaks nothing usable — and showing everyone else
"wrong email or password" would send a legitimate user off to reset a
password that was never the problem.

The `signIn` callback repeats the `emailVerified` check as defence in
depth, so a future provider or code path can't bypass the gate by
returning a user object directly.

## Flow

1. `POST /api/auth/register` creates the user **without**
   `emailVerified`, records consent, grants free roles, then calls
   `sendVerificationEmail()`. It returns
   `{ data: { verificationRequired: true } }`.
2. The register form shows "check your inbox" rather than signing in
   (which the gate would refuse).
3. The user opens `/verify-email?token=…`, which posts to
   `POST /api/auth/verify-email`.
4. `verifyEmailToken()` consumes the token and stamps `emailVerified`.
5. `POST /api/auth/resend-verification` issues a new link on demand.

A send failure never fails registration: `sendVerificationEmail()` swallows
its own errors, and the email is queued in the outbox for retry. The
account exists either way; the user can always ask for a new link.

## Tokens

| Property  | Value                                           |
| --------- | ----------------------------------------------- |
| Size      | 32 random bytes, hex (256 bits)                 |
| Stored as | SHA-256 hash (`tokenHash`), never the raw value |
| TTL       | 24 hours                                        |
| Per user  | **At most one** — `userId` is `UNIQUE`          |
| Use       | Single-use, consumed by the delete itself       |

### Consumption is a delete, not a read-then-write

`verifyEmailToken()` arbitrates on `deleteMany` inside a transaction and
only stamps `emailVerified` if that delete matched exactly one row. Under
Postgres' READ COMMITTED, a second concurrent delete of the same row
blocks until the first commits and then matches nothing, so exactly one
request can consume a token. This matters in practice: mail clients
prefetch links, and people double-click.

A request that loses that race **re-reads** the account's verification
state before reporting. It says `already_verified` only if the account
really is verified, and `invalid` otherwise — a token can also vanish for
reasons that verify nobody (an admin purge, an account-deletion cascade),
and telling that user to go and sign in would be a lie.

Replaying a spent token returns `invalid`, which is indistinguishable from
a wrong token — so a token can't be used to probe which accounts exist.

### One token per user, and what it costs

Issuing a link invalidates the previous one. That's a database guarantee
(`UNIQUE(userId)` plus an upsert), not something the application races
for: delete-then-insert would let two overlapping resends leave two live
tokens.

**The UX cost:** if a user requests several links in quick succession,
only the newest works. Someone who then clicks the _first_ email gets
"invalid link". Mitigations in place:

- the resend button is disabled while in flight and after a successful
  request, so the common double-click can't produce two links;
- the resend endpoint allows 3 per address per hour and 5 per IP;
- the invalid/expired page explains the link is wrong or already used and
  offers a fresh one, rather than dead-ending.

Accepting this was deliberate. The alternative — keeping several tokens
live per user — widens the window in which a leaked older link still works,
for a problem that a clear error message handles.

## Enumeration

`POST /api/auth/resend-verification` returns the same 200 and the same
message for every input: unknown address, already verified, suspended,
soft-deleted, OAuth-only, or over the per-address rate limit. Nothing in
the response, the status code, or the presence of an error distinguishes a
registered address from an unregistered one.

The per-address rate-limit key is lower-cased so case variants of one
address can't multiply the budget. The **lookup** is not lower-cased:
nothing in this codebase normalises addresses on the way in, so an account
registered as `Bao@Example.com` is stored and looked up that way. The
resend path tries an exact match first and falls back to a
case-insensitive one. Normalising addresses repo-wide is the real fix and
needs a migration plus a decision about existing rows — see the technical
debt register.

## Operations

```sql
-- Accounts stuck unverified
SELECT count(*) FROM "users"
WHERE "emailVerified" IS NULL AND "passwordHash" IS NOT NULL
  AND "deletedAt" IS NULL;

-- Outstanding tokens, oldest first
SELECT "userId", "createdAt", "expiresAt"
FROM "email_verification_tokens"
ORDER BY "createdAt";

-- Did the link actually go out? (see docs/ops/email-outbox.md)
SELECT "to", "status", "attempts", "sentAt", "lastError"
FROM "email_outbox"
WHERE "idempotencyKey" LIKE 'email-verification:%'
ORDER BY "createdAt" DESC LIMIT 20;
```

Expired tokens are deleted when someone tries to use one. There is no
sweeper cron for tokens nobody ever clicks — they're small and harmless,
but the table grows slowly. Worth adding alongside the outbox retention
job.

## Verify a user by hand

Only when someone genuinely can't receive email:

```sql
UPDATE "users" SET "emailVerified" = now() WHERE "email" = '<address>';
DELETE FROM "email_verification_tokens" WHERE "userId" = '<id>';
```

## Not exercised end-to-end

Same caveat as every external integration in this repo: no verification
email has ever been delivered by a live Resend account here. The logic is
covered by `src/services/__tests__/email-verification.test.ts` (including
the concurrency and replay cases), and every path has been type-checked,
but the round trip through a real inbox has not been run.
