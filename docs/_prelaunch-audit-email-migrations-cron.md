# Pre-launch audit — email outbox/verification migrations, deploy state, retry cron

Scope: the five uncommitted-to-dev migrations dated `20260910*`, whether they
are safe to apply, what depends on them, the `email-retry` cron vs. the Vercel
Hobby plan, and the `pg_advisory_xact_lock` call in the outbox throttle. Every
finding was verified against the live databases (read-only), the installed
package versions, and the code at `file:line` — not from docs alone. No
application code was changed. Date: 2026-09-10.

---

## 1. Migration state — dev is behind, production is NOT

| Database                           | Supabase ref                                                                                                                         | `prisma migrate status`                                                                            | Note                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Production** (`fgrapher-prod`)   | `mplyshxbtzovpexjhkoh` — from `.env.production`, also the value in Vercel Production `DATABASE_URL`/`DIRECT_URL`                     | **"Database schema is up to date!"** — all 41 migrations applied                                   | verified via `pnpm exec dotenv -e .env.production -- prisma migrate status`  |
| **Dev / Preview** (`fgrapher-dev`) | `oikhakndcpezqaxpakzv` — from `.env` / `.env.local`; the ref the Supabase MCP is scoped to; every Vercel Preview deploy also uses it | **5 migrations not applied** (last applied: `20260907092645_generalize_payment_model`, 2026-09-07) | `_prisma_migrations` has 36 rows, no `rolled_back_at`, no partial/failed row |

The two projects share the pooler **host** (`aws-0-ap-southeast-1.pooler.
supabase.com`) — that is shared infra; identity is the `postgres.<ref>`
username. Production is fully migrated and **not blocked**. The gap is
dev/Preview only: the local dev DB was seeded/restored from a point behind
these migrations, or `prisma migrate dev` was never run against it after they
were authored (they were still deployed to prod through CI on merge to
`master`, per `docs/MIGRATIONS.md`).

The five, in `prisma migrate deploy` apply order (lexical filename = intended
dependency order — confirmed):

1. `20260910005958_add_email_outbox` (00:59:58)
2. `20260910010000_add_email_verification_tokens` (01:00:00)
3. `20260910120000_email_outbox_locking_and_token_hashing`
4. `20260910130000_one_verification_token_per_user`
5. `20260910130100_scrub_sensitive_email_bodies`

---

## 2. SQL chain audit

| #   | Statements                                                                                                                                                                                                                                                                                                                                              | Verdict                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `CREATE TYPE "EmailOutboxStatus"`, `CREATE TABLE "email_outbox"`, 3 indexes (1 unique)                                                                                                                                                                                                                                                                  | Safe. New table, new enum.                 |
| 2   | `CREATE TABLE "email_verification_tokens"`, 3 indexes, FK → `users(id) ON DELETE CASCADE`                                                                                                                                                                                                                                                               | Safe. New table. FK target `users` exists. |
| 3   | `ALTER TYPE … ADD VALUE 'SENDING'`; `DROP INDEX email_outbox_idempotencyKey_idx`; `ALTER TABLE email_outbox ADD lockedAt`, `ALTER COLUMN nextAttemptAt DROP NOT NULL`; new index; `DELETE FROM email_verification_tokens`; `DROP INDEX …_token_key`; `ALTER TABLE … DROP COLUMN token, ADD COLUMN tokenHash TEXT NOT NULL`; unique index on `tokenHash` | Safe **on this DB**. See notes below.      |
| 4   | dedupe `DELETE` (self-join, keep newest per `userId`); `DROP INDEX …_userId_idx`; `CREATE UNIQUE INDEX …_userId_key`                                                                                                                                                                                                                                    | Safe.                                      |
| 5   | `ALTER TABLE email_outbox ADD COLUMN sensitive BOOLEAN NOT NULL DEFAULT false`, `ALTER COLUMN html DROP NOT NULL`                                                                                                                                                                                                                                       | Safe. Defaulted non-null add.              |

Notes on migration 3 (the only non-trivial one):

- **`ALTER TYPE … ADD VALUE` inside a transaction.** Prisma runs each
  migration file in one transaction. PostgreSQL ≥ 12 permits `ADD VALUE`
  inside a transaction as long as the new value is **not used** in the same
  transaction. This migration only _adds_ `'SENDING'` (later DDL/DML does not
  reference it), and both databases are **PostgreSQL 17.6**. No issue.
- **`ALTER TABLE … DROP COLUMN token, ADD COLUMN tokenHash TEXT NOT NULL`
  with no default** would fail on a non-empty table. It is guarded by the
  preceding `DELETE FROM "email_verification_tokens"`, and on dev the table
  is brand-new and empty anyway. The migration comment says as much.
- Dropping `email_outbox_idempotencyKey_idx` is fine — the `@unique` on
  `idempotencyKey` (migration 1) already provides an index; the standalone
  one was redundant.

**Verdict: applying all five with `prisma migrate deploy`, in order, is safe.**
Every statement targets one of the two new tables, which are empty on dev, so
lock time is negligible and there is no data at risk. The `DELETE` statements
in migrations 3 and 4 are defensive no-ops against an empty table.

---

## 3. What breaks while the five are absent (dev / Preview only)

Production has them, so production is unaffected. On dev and every Preview
deployment (which share `fgrapher-dev`):

| Path                                                                                             | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/register`                                                                        | User row is created; `sendVerificationEmail()` → `createEmailVerificationToken()` hits the missing `email_verification_tokens` table, **throws, and is swallowed** (`src/services/email-verification.ts:112-115`). Registration returns success with `verificationRequired: true`, but **no token and no email exist**, and `src/lib/auth.ts` `authorize()` then refuses every login for that account. Effectively a lock-out for any non-seed credential signup on Preview. Seed accounts are pre-verified, so seeded logins still work. |
| Any keyed/throttled `sendEmail()` (verification, password reset, most booking/subscription mail) | `reserveEmail()` / `reserveThrottledEmail()` → `db.emailOutbox.create` on the missing table → throws → caught in `sendReservedEmail()` → returns `{ success:false, queued:false, error:"reserve_failed" }`. **The email is never sent and never queued.** The caller's mutation still succeeds (by design).                                                                                                                                                                                                                               |
| Any unkeyed `sendEmail()`                                                                        | `deliverEmail()` runs first (delivers if `RESEND_API_KEY` is set), then `recordSentEmail()`/`enqueueEmail()` fails silently via `safeRecord()`. Mail may go out but is not recorded.                                                                                                                                                                                                                                                                                                                                                      |
| `GET /api/cron/email-retry` (Preview cron)                                                       | `processEmailOutbox()` → `reclaimStaleLocks()` `updateMany` on the missing table → throws → the route has no `try/catch` around the work → **HTTP 500** in the Preview cron log. Dev-only noise.                                                                                                                                                                                                                                                                                                                                          |
| `pnpm db:migrate:dev` (next time anyone runs it)                                                 | Prisma applies these five first, then proceeds — the normal, intended way to close the gap.                                                                                                                                                                                                                                                                                                                                                                                                                                               |

No production-facing breakage. No admin/dashboard read depends on these
tables (`getEmailOutboxStats()` is only called by the cron route).

---

## 4. Read-only preflight checks (run against the target DB before applying)

```sql
-- 4.1 Neither table should exist yet on dev.
SELECT to_regclass('public.email_outbox')            AS email_outbox,
       to_regclass('public.email_verification_tokens') AS email_verification_tokens;
-- expect: both NULL on dev; both non-NULL on prod (already migrated)

-- 4.2 The enum should not yet carry SENDING on dev.
SELECT enumlabel FROM pg_enum
  JOIN pg_type t ON t.oid = pg_enum.enumtypid
 WHERE t.typname = 'EmailOutboxStatus' ORDER BY enumsortorder;
-- expect on dev: PENDING, SENT, FAILED  (no SENDING)

-- 4.3 No failed/partial migration row is sitting in the ledger.
SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
  FROM _prisma_migrations
 WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;
-- expect: 0 rows

-- 4.4 Confirm which project you are connected to (ref is in the username,
--     not the host). Run with the same env the migrate command will use.
SELECT current_user, current_database();
-- current_user is 'postgres.<ref>'; match it to the intended target

-- 4.5 users table (FK target of migration 2) is present.
SELECT to_regclass('public.users') IS NOT NULL AS users_present;
```

Also, non-SQL:

```bash
# Shows exactly the 5 pending, in order, and no drift warning.
pnpm exec dotenv -e .env -- prisma migrate status            # dev
pnpm exec dotenv -e .env.production -- prisma migrate status  # prod (expect "up to date")

git status   # must be clean — schema.prisma must equal the sum of committed migrations
```

## 5. Applying + rollback runbook (owner action — not performed here)

**Apply to dev** (the only outstanding work):

```bash
# Guarded by scripts/check-db-safety.mjs (dev ref allow-list) — preferred.
pnpm db:migrate:dev
# or, non-interactive, same result since the 5 files already exist:
pnpm exec dotenv -e .env -- prisma migrate deploy
```

Then re-run the seed if the dev data is expected to include outbox rows
(`pnpm db:seed` — seed accounts are created already-verified).

**Do NOT** run any migrate command against production by hand. Production is
already at 41/41; if a future migration is authored it reaches prod only
through CI on merge to `master` with the manual approval gate
(`docs/MIGRATIONS.md` §1, §5).

**Rollback:** reverse SQL for migrations 3–5 already exists, reviewed and
runnable, in `prisma/rollbacks/` (migrations 1–2 are plain `DROP TABLE`; the
directory README has the procedure). Order to reverse is 5 → 4 → 3 → 2 → 1.
After running a reverse script, tell Prisma with
`prisma migrate resolve --rolled-back <migration_name>` — never hand-edit
`_prisma_migrations`. Roll the _application code_ back first (the reverse SQL
drops columns the deployed code reads). Data-loss notes are at the top of
each rollback file; the only meaningful one here is that hashed verification
tokens cannot be un-hashed (acceptable — users re-request a link).

---

## 6. `email-retry` cron vs. Vercel Hobby — reconciliation

**Docs were stale.** `docs/ops/email-outbox.md` described the cron as
`*/5 * * * *` / "every 5 minutes" in three places. The committed
`vercel.json` has **`0 1 * * *`** (once daily) since commit `5bb3353`
("drop email-retry cron to daily for the Vercel Hobby plan"). Fixed in this
change — see the doc diff.

Verified against Vercel's current limits
(<https://vercel.com/docs/cron-jobs/usage-and-pricing>, last updated
2026-07-15):

|       | cron jobs / project | min interval     | precision          |
| ----- | ------------------- | ---------------- | ------------------ |
| Hobby | 100                 | **once per day** | per-hour (±59 min) |
| Pro   | 100                 | once per minute  | per-minute         |

- The old "max 2 cron jobs on Hobby" limit is **gone** — 100 on every plan.
  `vercel.json`'s 10 crons are fine on Hobby; only the _frequency_ of
  `email-retry` was the deploy blocker.
- `0 1 * * *` fires anywhere in the **01:00–01:59 UTC** hour on Hobby.

**Consequences of the daily schedule (now documented):**

1. The 1/2/4/8-minute backoff curve in `getBackoffMs()` is real code but its
   effect collapses: every `nextAttemptAt` is already past by the next daily
   run, so a persistently-failing email gets **one retry per day** and takes
   **~4 days** to reach `FAILED`, not ~15 minutes.
2. A **first-attempt** failure for user-blocking mail (email verification,
   password reset) is not retried until the next 1am window. If `RESEND_API_KEY`
   is briefly unset or Resend has a blip at signup time, that user waits up to
   ~24h for the link unless they hit "resend" (which mints a fresh attempt
   immediately).
3. **Resend idempotency (`Idempotency-Key`, ~24h retention).** Every attempt
   forwards the row's key (`src/lib/email-transport.ts:118-120`, resend
   v6.20.0 — signature confirmed in the installed `.d.mts`). It guards one
   case: a row Resend accepted but our DB failed to finalise (crash between
   send and update), later requeued by the 10-minute stale-lock sweep. On a
   5-minute cron the requeue is well inside 24h; on the daily cron it lands
   ~24h later, at/past the retention edge, so that single guarantee is
   weakened. Exposure is narrow (rare compound failure; cost is one duplicate
   email, never data loss) but it is a second reason to move off daily.

**Recommended reliable-scheduler path (owner decision):**

- **Preferred: Vercel Pro** + restore `"schedule": "*/5 * * * *"`. One
  setting, no new moving parts, also unblocks precise timing for the other
  nine crons (several are semantically "run at HH:00" but on Hobby drift
  across the hour).
- **If staying on Hobby: external driver** hitting the deployed
  `/api/cron/email-retry` every 2–5 min with
  `Authorization: Bearer $CRON_SECRET`. Options, roughly in order of
  operational simplicity:
  - **GitHub Actions** `on: schedule: - cron: '*/5 * * * *'` calling `curl`
    with the secret from Actions secrets. Free, in-repo, but GitHub cron can
    itself be delayed several minutes under load.
  - **Supabase `pg_cron` + `pg_net`** (`cron.schedule('email-retry', '*/5 * * * *', $$select net.http_get('https://<host>/api/cron/email-retry', headers => '{"Authorization":"Bearer ..."}'::jsonb)$$)`).
    Runs next to the DB, no third party; secret lives in the DB.
  - **Upstash QStash / cron-job.org** — managed, reliable, one more vendor
    - secret to hold.
      Keep `vercel.json`'s `0 1 * * *` as a floor either way (harmless backstop).

The route needs **no code change** for any of these — it is idempotent,
concurrency-safe, GET, and already `CRON_SECRET`-gated fail-closed.

---

## 7. `pg_advisory_xact_lock` — runtime correctness

`src/services/email-outbox.ts:150-186`, `prismaThrottleReservationStore.withLock`:

```ts
db.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
  return fn({ hasRecent, create }); // both run on tx
});
```

**Correct, including the parts that are easy to get wrong:**

- **`_xact_` variant, not session.** The lock releases on `COMMIT`/`ROLLBACK`.
  This is what makes it safe over Supabase's **transaction-mode pooler**
  (`DATABASE_URL` has `?pgbouncer=true`, port 6543): the server connection
  returns to the pool with no lock held. A session-scoped `pg_advisory_lock`
  here would leak locks into pooled connections — a latent outage. The code
  and its comment get this right.
- **Prisma interactive transaction over PgBouncer.** All statements in the
  callback run on the one connection Prisma holds for the transaction, so the
  lock taken in statement 1 is visible to the `findFirst`/`create` that
  follow. Fine on pgbouncer transaction mode.
- **`hashtextextended(text, int8) → bigint`** exists since PG 11; both DBs are
  PG 17. `${lockKey}` binds as `$1::text` (the function has a single
  non-ambiguous signature), the `0` seed is a literal. `pg_advisory_xact_lock(bigint)`
  accepts the full int64 range, so negative hashes are fine.
- **Return value** of `$executeRaw` (row count, 0 for a `SELECT`) is
  correctly ignored.
- **Namespace:** advisory locks share one 64-bit space cluster-wide. A hash
  collision with another advisory lock (Prisma Migrate's, or another
  `scopeKey`) only causes brief extra serialisation of two unrelated
  throttle checks — not incorrectness. Negligible.

**One real, low-severity caveat:** if a single `scopeKey` (one conversation +
recipient) is hammered hard enough that a waiter blocks on
`pg_advisory_xact_lock` for longer than Prisma's interactive-transaction
timeout (default 5 s), the transaction aborts with P2028 and that one
notification email is skipped. The lock is held only for two fast indexed
queries, so this needs pathological contention on one conversation; the
caller treats a skipped throttled email as a normal outcome. Not worth code
change now; note it if chat-notification volume ever spikes.

**Verdict: no bug.** The throttle lock is one of the more carefully-reasoned
pieces of concurrency in the repo.

---

## 8. Other findings surfaced during the audit

- **RLS disabled on all 47 public tables (dev; almost certainly prod too).**
  Supabase's advisor flags this as critical: the `anon` / `authenticated`
  roles behind the Supabase client libraries can read/write every row. This
  is only _safe_ as long as nothing ever hands out the anon key to a browser
  and every DB path goes through Prisma on the pooled `postgres` user — which
  is the case today (`@supabase/supabase-js` is installed but the app reads
  through Prisma). It becomes a live hole the moment any client-side Supabase
  call is added. Decide before launch: either keep it deliberately (and
  document that the anon key must never ship to a client) or enable RLS with
  policies. Remediation SQL is long — see the advisor output; do **not**
  blanket-enable without policies or every table goes dark.
  <https://supabase.com/docs/guides/database/postgres/row-level-security>
- **`scripts/check-db-safety.mjs` comment was stale** ("the only Supabase
  project that exists today"). Prod exists now; comment updated in this
  change. The allow-list itself is unchanged and still correctly excludes the
  prod ref.
- **`docs/_prelaunch-audit-flags-cron.md` is stale** on crons — it says
  "`vercel.json` registers exactly 3 crons" (now 10) and reports the
  fail-open `CRON_SECRET` bug, which has since been fixed by the shared
  `requireCronSecret()` helper (fails closed outside development,
  `src/lib/auth-helpers.ts:66-78`). Left as-is (historical audit record);
  flagging here so it is not mistaken for current state.
- **Minor stale code comments** (not changed — application code out of scope
  for this audit): `src/services/email-outbox.ts:15` and `:380` still say
  "the next run five minutes later" / "overlapping its five minute interval".

---

## 9. Actions requiring owner approval

1. **Apply the 5 migrations to dev** — `pnpm db:migrate:dev` (§5). Safe, but
   not done here.
2. **Choose the retry-cron path** — Vercel Pro + `*/5 * * * *`, or an
   external scheduler (§6). Until then, transactional email retries (and
   first-attempt recovery for verification/reset links) are up to ~24h.
3. **Decide the RLS posture** (§8) before real users exist.
4. Nothing in this audit requires a code change to ship; items 2–3 are
   config/infra decisions.
