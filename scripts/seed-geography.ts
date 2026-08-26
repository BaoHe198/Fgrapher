import { PrismaClient } from "@prisma/client";

import { PROVINCE_REGISTRY } from "../prisma/data/provinces-registry";

const db = new PrismaClient();

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
