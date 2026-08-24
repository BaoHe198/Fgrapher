import { db } from "@/lib/db";

// Prompt B4/B8 — real administrative geography, queried from the Province/
// Ward tables (see prisma/schema.prisma and prisma/data/hcmc-wards.ts).
// CLAUDE.md mục 9 forbids hardcoding this list in application code — every
// caller (registration, profile settings, browse filters) must go through
// here, never a local constants array.

export async function listProvinces() {
  return db.province.findMany({
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export async function listWards(provinceCode?: string) {
  return db.ward.findMany({
    where: provinceCode ? { province: { code: provinceCode } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, provinceId: true },
  });
}

export async function getWardById(wardId: string) {
  return db.ward.findUnique({
    where: { id: wardId },
    select: {
      id: true,
      code: true,
      name: true,
      province: { select: { code: true, name: true } },
    },
  });
}
