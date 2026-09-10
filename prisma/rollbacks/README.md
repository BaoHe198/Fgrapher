# Migration rollback scripts

Prisma Migrate has no down-migration concept — `prisma migrate deploy`
only ever rolls forward. `docs/MIGRATIONS.md` §5 nonetheless requires that
"a rollback plan is written down _before_ starting, not improvised", so
for every migration that isn't a trivially reversible additive change,
the reverse SQL lives here as a reviewed, runnable script named after the
migration it undoes.

These are **not** run by Prisma and are **not** part of the migration
directory (a file dropped next to `migration.sql` risks confusing the
migration engine, and editing `migration.sql` itself after it has been
applied breaks its recorded checksum). They are run by hand, deliberately,
as part of the incident procedure in `docs/MIGRATIONS.md` §4.

## Running one

1. Take a backup / confirm a recent one exists (`docs/MIGRATIONS.md` §5).
2. Roll the application code back **first** — the reverse SQL removes
   columns the deployed code expects.
3. Run the script against the target database.
4. Tell Prisma the migration is no longer applied so a later
   `migrate deploy` re-runs it:
   `npx prisma migrate resolve --rolled-back <migration_name>`.
   Never hand-edit `_prisma_migrations`.

## Data loss

A rollback that drops a column drops its data. Each script states at the
top what is lost. Read that line before running it.
