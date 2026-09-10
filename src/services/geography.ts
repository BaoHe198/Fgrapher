import { db } from "@/lib/db";
import { CACHE_TAGS, CACHE_TTL, unstable_cache } from "@/lib/cache";

// Prompt B4/B8 — real administrative geography, queried from the Province/
// Ward tables (see prisma/schema.prisma and prisma/data/hcmc-wards.ts).
// CLAUDE.md mục 9 forbids hardcoding this list in application code — every
// caller (registration, profile settings, browse filters) must go through
// here, never a local constants array.
//
// These three are cached in the Data Cache (24h): the data is fully public,
// shared by every visitor, and contains no Date fields (so it survives the
// cache's JSON round-trip unchanged).
//
// Bounded staleness, stated honestly: nothing in the running app writes to
// Province / Ward. That data changes only by running a seed script against
// the database, which is a deploy-adjacent operation — and a deploy drops the
// entire Data Cache. `revalidateGeography()` exists in lib/cache.ts for a
// future admin-driven geography edit, but no runtime path calls it today. So
// in practice the effective bound is "until the next deploy", with the 24h
// TTL as the backstop if geography is ever reseeded against a live deployment
// without a redeploy. The CDN `Cache-Control` on /api/geography/* (see
// GEOGRAPHY_CACHE_CONTROL) is a separate layer with its own independent
// lifetime — it is not affected by Data Cache tag invalidation.

export const listProvinces = unstable_cache(
  async () =>
    db.province.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ["geography", "provinces"],
  { tags: [CACHE_TAGS.geography], revalidate: CACHE_TTL.geography },
);

export const listWards = unstable_cache(
  async (provinceCode?: string) =>
    db.ward.findMany({
      where: provinceCode ? { province: { code: provinceCode } } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, provinceId: true },
    }),
  ["geography", "wards"],
  { tags: [CACHE_TAGS.geography], revalidate: CACHE_TTL.geography },
);

export const getWardById = unstable_cache(
  async (wardId: string) =>
    db.ward.findUnique({
      where: { id: wardId },
      select: {
        id: true,
        code: true,
        name: true,
        province: { select: { code: true, name: true } },
      },
    }),
  ["geography", "ward-by-id"],
  { tags: [CACHE_TAGS.geography], revalidate: CACHE_TTL.geography },
);
