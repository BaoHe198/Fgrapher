#!/usr/bin/env node
// Guards destructive Prisma commands (db:reset, db:push) from ever running
// against a database that isn't explicitly known to be safe.
//
// Supabase's pooled connection string hostname (aws-0-<region>.pooler.
// supabase.com) is SHARED infrastructure across every project in a region —
// the dev and production databases resolve to the identical host. The only
// thing that actually distinguishes one project from another is the
// username, which embeds the project ref: postgres.<project-ref>. So this
// checks the ref, not the host.
//
// This is an allow-list, not a block-list: anything not explicitly listed
// below is refused, including the production database — no further edit is
// needed here to protect prod, since its ref simply isn't on the list.
//
// The production project now exists (Supabase ref `mplyshxbtzovpexjhkoh`,
// wired into Vercel Production + the local-only `.env.production`). It is
// deliberately NOT added below: db:reset / db:push must never run against
// it. Migrations reach prod only via `prisma migrate deploy` in CI on
// merge to master — see docs/MIGRATIONS.md.
const SAFE_DB_REFS = [
  "oikhakndcpezqaxpakzv", // fgrapher-dev — the only ref these destructive commands may touch
];

const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
const ref = url.match(/postgres\.([a-z0-9]+):/)?.[1];

if (!ref || !SAFE_DB_REFS.includes(ref)) {
  console.error("\n🚫 Refused: DATABASE_URL does not point at a known-safe database.");
  console.error(`   Project ref found: ${ref ?? "(could not parse from DATABASE_URL)"}`);
  console.error(`   Safe refs: ${SAFE_DB_REFS.join(", ")}`);
  console.error(
    "   This command runs prisma migrate reset / db push, which can wipe data.\n" +
      "   If you really mean to run this against a database that isn't in\n" +
      "   SAFE_DB_REFS, add its ref there deliberately — don't bypass this check.\n",
  );
  process.exit(1);
}

console.log(`✓ DATABASE_URL points at a known-safe database (${ref}) — proceeding.`);
