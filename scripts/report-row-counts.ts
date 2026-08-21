// Read-only verification: lists every table in the public schema and its
// row count, so you can confirm a database is clean (production) or
// inspect what's actually in it (dev). Never writes anything.
//
// Run with:
//   npx tsx --env-file=.env.production scripts/report-row-counts.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const ref = (process.env.DATABASE_URL ?? "").match(/postgres\.([a-z0-9]+):/)?.[1];
  console.log(`Database project ref: ${ref ?? "(could not parse DATABASE_URL)"}\n`);

  const tables = await db.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  console.log(`${tables.length} tables found.\n`);

  let total = 0;
  for (const { table_name } of tables) {
    const result = await db.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${table_name}"`,
    );
    const count = Number(result[0].count);
    total += count;
    console.log(`${table_name.padEnd(30)} ${count}`);
  }

  console.log(`\nTotal rows across all tables: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
