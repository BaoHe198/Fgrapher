# Migrations

The rule: migrations are created locally against the dev database and
committed. `develop` and every feature branch's Preview deployment
already read that same dev database — see `docs/ENVIRONMENTS.md` for
why there's no separate staging database — so a migration is live for
review the moment `pnpm db:migrate:dev` applies it locally, no extra
deploy step involved. Production is the one database that's genuinely
separate: migrations reach it only via CI on merge to `master`, after a
required manual approval. Never run a migration command directly
against production — always through that pipeline.

## 1. Creating a migration

1. Edit `prisma/schema.prisma`.
2. `pnpm db:migrate:dev --name descriptive_name` — this is guarded by
   `scripts/check-db-safety.mjs` and will refuse to run against anything
   but the known dev database ref.
3. **Read the generated SQL in `prisma/migrations/<timestamp>_name/
migration.sql` before committing** — never commit a migration you
   haven't read. Prisma usually gets this right, but it's the one file
   in the whole change where a mistake is expensive and hard to reverse
   once it's run against real data.
4. Test the app locally against the new schema — actually exercise the
   feature that needed the change, not just `pnpm build`.
5. Commit the `schema.prisma` change and the new migration folder
   together, in the same commit.

## 2. Writing safe migrations

The cases that will actually come up in this project:

- **Adding a nullable column**: always safe. This is the overwhelming
  majority of changes so far (every MODEL-role field added in this
  repo's history was nullable/defaulted for exactly this reason).
- **Adding a non-nullable column**: needs either a `@default(...)` in
  the schema (Prisma generates a backfill as part of the `ALTER TABLE`,
  safe for most table sizes) or, for a large table where a single
  locking `ALTER TABLE ... SET NOT NULL` would be too slow, the
  three-step deploy in §3: add nullable → backfill → make required in a
  later migration.
- **Renaming a column**: **never rename directly on a live table.**
  Prisma represents a rename in `schema.prisma` as a plain drop+add
  unless you hand-edit the generated migration SQL to use `ALTER TABLE
... RENAME COLUMN`. Prefer the explicit sequence instead: add the new
  column, backfill from the old one, switch every read/write in the
  code to the new column, deploy, then drop the old column in a later
  release. Never a single migration that does all of this at once.
- **Dropping a column**: only after every deployed version of the code
  has stopped reading/writing it. If in doubt, wait one full release
  cycle after the code change lands before dropping the column.
- **Adding an index on a large table**: a plain Prisma-generated index
  migration takes a lock for the duration of the build. For any table
  that might be large in production, add the index via raw SQL in the
  migration using `CREATE INDEX CONCURRENTLY` instead (requires running
  outside a transaction — Prisma migrations run in a transaction by
  default, so this needs `prisma migrate dev --create-only` to generate
  the migration file without applying it, then hand-edit the SQL before
  applying).
- **Changing a column's type**: usually needs the same add/backfill/swap
  pattern as a rename — Postgres can sometimes do an in-place type
  change safely (e.g., `VARCHAR(50)` → `VARCHAR(100)`), but anything
  that could fail to cast existing data (e.g., `String` → `Int`) should
  go through add-new-column/backfill/switch-code/drop-old instead.

## 3. The three-step pattern for breaking changes

Worked example from this codebase: suppose `Profile.height` (currently
optional, added for the MODEL role) needed to become required.

1. **Release 1**: add the column as nullable (already done — it always
   was, so this step is skipped in this specific example, but for a
   genuinely new required field, this release just adds it nullable and
   deploys code that always writes it going forward).
2. **Backfill**: run a one-off script (not a migration file — a script
   under `scripts/`) that fills in a value for every existing row
   missing one. For `height`, there's no sensible default to backfill
   with, which is exactly why it should stay optional — a real example
   of this pattern in this codebase would be something like backfilling
   `Profile.currency` (defaulted to `"VND"`) if that default hadn't
   existed from the start.
3. **Release 2**: once every row has a value, a follow-up migration adds
   `NOT NULL` (and drops the `@default` if it was only there for the
   backfill's sake). Only ship this after confirming step 2 actually
   completed — a `NOT NULL` migration against a table with real nulls
   still in it fails outright, which is a safe failure mode, but
   confirm first rather than relying on that safety net.

## 4. Rollback

**A migration fails halfway on production:**

1. Don't panic-run another migration on top of a failed one. Prisma
   tracks migration state in the `_prisma_migrations` table — a failed
   migration leaves a row there marked as not finished.
2. Restore from the Supabase point-in-time-recovery snapshot to just
   before the migration started (see `docs/OPERATIONS.md` §5) if the
   failure left data in a bad state, not just the schema.
3. Fix whatever caused the failure in the migration SQL itself (or the
   underlying data that made it fail).
4. Fix the `_prisma_migrations` table if needed: `prisma migrate
resolve --rolled-back <migration-name>` marks it as rolled back so
   `prisma migrate deploy` will attempt it again; `--applied` marks it
   as successfully applied if you fixed the schema manually and just
   need Prisma's bookkeeping to match reality. Never hand-edit rows in
   `_prisma_migrations` directly — always through `prisma migrate
resolve`.
5. Re-run `prisma migrate deploy` once the above is confirmed clean.

## 5. Pre-production checklist

Before a migration-containing PR is merged from `develop` into `master`:

- [ ] Reviewed the generated SQL (§1, step 3)
- [ ] Tested against `develop`'s Preview deployment (already applied,
      since it shares the dev database) — but remember dev's seed data
      volume is nothing like production's; an index-creation migration
      that's instant on 50 seed rows can lock a 500k-row production
      table for minutes, so estimate that separately, not from how it
      felt in dev
- [ ] A backup was taken (or confirmed recent — check Supabase's backup
      retention window for the production project) immediately before
      the migration runs
- [ ] Any application code that depends on the new schema is already
      deployed, or is deploying in the same release (never migration
      first, dependent code "later" — for a breaking change, follow §3)
- [ ] An estimate of how long any affected table will be locked, for
      anything beyond a trivial nullable-column addition
- [ ] A rollback plan is written down _before_ starting, not improvised
      if something goes wrong (§4)
