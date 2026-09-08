#!/usr/bin/env node
// Guards e2e/global-setup.ts's `prisma migrate reset --force` from ever
// running against anything but the disposable e2e test database.
//
// This is a DIFFERENT check from scripts/check-db-safety.mjs — that one
// allow-lists the Supabase dev project ref for db:push/db:reset run from
// the repo root. The e2e test database must never be a Supabase project
// at all (dev or prod) — it's meant to be a throwaway local/CI Postgres
// instance, matching e2e/.env.test.example (localhost:5433) and
// .github/workflows/test.yml's service container (localhost:5432), both
// deliberately named "fgrapher_test" to make this checkable. Fails
// closed: anything not matching that exact shape is refused, including a
// dev/.env.local DATABASE_URL that leaked into the shell's environment
// (e.g. from a `source .env.local` earlier in the same terminal session)
// bypassing `pnpm test:e2e`'s `dotenv -e e2e/.env.test --` wrapper.
const SAFE_HOSTS = new Set(["localhost", "127.0.0.1"]);
const SAFE_DB_NAME = "fgrapher_test";

function checkUrl(name, rawUrl) {
  if (!rawUrl) return; // DIRECT_URL is optional for e2e — only checked if set

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail(name, rawUrl, "not a parseable URL");
  }

  if (/supabase\.(co|com)$/.test(parsed.hostname)) {
    fail(name, rawUrl, "resolves to a Supabase host — never a disposable test DB");
  }
  if (!SAFE_HOSTS.has(parsed.hostname)) {
    fail(name, rawUrl, `host "${parsed.hostname}" is not localhost/127.0.0.1`);
  }
  const dbName = parsed.pathname.replace(/^\//, "");
  if (dbName !== SAFE_DB_NAME) {
    fail(name, rawUrl, `database name "${dbName}" is not "${SAFE_DB_NAME}"`);
  }
}

function fail(name, rawUrl, reason) {
  console.error(`\n🚫 Refused: ${name} does not point at the disposable e2e test database.`);
  console.error(`   Reason: ${reason}`);
  console.error(
    "   This guards e2e/global-setup.ts's `prisma migrate reset --force`, which\n" +
      "   wipes the target database entirely. Expected shape: postgresql://.../fgrapher_test\n" +
      "   on localhost/127.0.0.1 — see e2e/.env.test.example. If your shell has a dev/prod\n" +
      "   DATABASE_URL exported from an earlier `source .env.local`, unset it before running\n" +
      "   `pnpm test:e2e`, or open a fresh shell.\n",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("\n🚫 DATABASE_URL is not set — see e2e/README.md.\n");
  process.exit(1);
}

checkUrl("DATABASE_URL", process.env.DATABASE_URL);
checkUrl("DIRECT_URL", process.env.DIRECT_URL);

console.log(`✓ DATABASE_URL/DIRECT_URL point at the disposable e2e test database (${SAFE_DB_NAME}) — proceeding.`);
