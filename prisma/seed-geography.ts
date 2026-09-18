import type { PrismaClient } from "@prisma/client";

import { PROVINCE_REGISTRY } from "./data/provinces-registry";

/**
 * Idempotently imports the nationwide reference geography. It batches new
 * wards per province instead of issuing thousands of one-row upserts, while
 * still updating a renamed row when an existing stable code is retained.
 * Stale rows are kept because live User/Profile records may reference them.
 */
export async function seedGeography(db: PrismaClient) {
  let wardCount = 0;

  for (const { province: provinceData, wards } of PROVINCE_REGISTRY) {
    if (new Set(wards.map((ward) => ward.code)).size !== wards.length) {
      throw new Error(`Duplicate ward code in ${provinceData.name}`);
    }

    const province = await db.province.upsert({
      where: { code: provinceData.code },
      create: provinceData,
      update: { name: provinceData.name },
    });
    const existing = await db.ward.findMany({
      where: { provinceId: province.id },
      select: { id: true, code: true, name: true },
    });
    const existingByCode = new Map(existing.map((ward) => [ward.code, ward]));
    const missing = wards.filter((ward) => !existingByCode.has(ward.code));
    const renamed = wards.filter((ward) => {
      const current = existingByCode.get(ward.code);
      return current && current.name !== ward.name;
    });

    if (missing.length > 0) {
      await db.ward.createMany({
        data: missing.map((ward) => ({
          provinceId: province.id,
          code: ward.code,
          name: ward.name,
        })),
        skipDuplicates: true,
      });
    }
    if (renamed.length > 0) {
      await db.$transaction(
        renamed.map((ward) =>
          db.ward.update({
            where: {
              provinceId_code: { provinceId: province.id, code: ward.code },
            },
            data: { name: ward.name },
          }),
        ),
      );
    }

    wardCount += wards.length;
    console.log(
      `Seeded province ${province.name} (${wards.length} wards, ${missing.length} new)`,
    );
  }

  console.log(
    `Seeded ${PROVINCE_REGISTRY.length} provinces and ${wardCount} wards total`,
  );
}
