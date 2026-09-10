import { PrismaClient } from "@prisma/client";

import { PROVINCE_REGISTRY } from "../prisma/data/provinces-registry";

// Connect over the DIRECT (non-pooled) URL, not the pooled one. This is a
// one-shot batch of hundreds of upserts run from CI, not the app: routing
// it through Supabase's transaction-mode pgbouncer breaks Prisma's
// prepared statements mid-run (`prepared statement "s1" does not exist`,
// PostgresError 26000). `prisma migrate deploy` in the same workflow
// already uses DIRECT_URL for exactly this reason. Falls back to
// DATABASE_URL for local runs where only that is set.
const db = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

// Geography-only counterpart to prisma/seed.ts's seedGeography() step, for
// environments (production) where the rest of seed.ts's fake *@test.com
// users/bookings/products must never run. Same upsert logic, kept in sync
// by hand since seed.ts can't safely be imported as a module (it has a
// top-level main() that seeds test users).
async function main() {
  let wardCount = 0;

  for (const { province: provinceData, wards } of PROVINCE_REGISTRY) {
    const province = await db.province.upsert({
      where: { code: provinceData.code },
      create: provinceData,
      update: { name: provinceData.name },
    });

    for (const [index, name] of wards.entries()) {
      const code = String(index + 1).padStart(3, "0");
      await db.ward.upsert({
        where: { provinceId_code: { provinceId: province.id, code } },
        create: { provinceId: province.id, code, name },
        update: { name },
      });
    }

    wardCount += wards.length;
    console.log(`Seeded province ${province.name} (${wards.length} wards)`);
  }

  console.log(
    `Seeded ${PROVINCE_REGISTRY.length} province(s) and ${wardCount} wards total`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
