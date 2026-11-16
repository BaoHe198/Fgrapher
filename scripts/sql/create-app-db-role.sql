-- A database role for the running web app with the least it needs
-- (owner checklist #35). Run ONCE per database in the Supabase SQL editor,
-- signed in as the project owner (role `postgres`).
-- Steps, checks and rollback: docs/ops/least-privilege-db-user.md
--
-- Replace <STRONG_PASSWORD> first: 32+ random characters, letters and
-- digits only (no @ : / ? # — they would need escaping in the URL).
--
-- What the app gets: read and write rows in the app's tables. What it does
-- NOT get: creating, altering, dropping or truncating tables, creating
-- roles or databases, bypassing row level security, superuser. Migrations
-- keep running as `postgres` through GitHub Actions (PRODUCTION_DIRECT_URL),
-- which is the only thing that changes table structure.

CREATE ROLE fgrapher_app WITH LOGIN PASSWORD '<STRONG_PASSWORD>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE postgres TO fgrapher_app;
GRANT USAGE ON SCHEMA public TO fgrapher_app;

-- Every table that exists now...
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fgrapher_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fgrapher_app;

-- ...and every table a later migration creates (migrations run as postgres).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fgrapher_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO fgrapher_app;

-- The migration ledger is Prisma Migrate's, never the running app's.
REVOKE ALL ON TABLE public."_prisma_migrations" FROM fgrapher_app;
