import { db } from "@/lib/db";
import {
  CACHE_KEY_VERSION,
  CACHE_TAGS,
  CACHE_TTL,
  unstable_cache,
} from "@/lib/cache";

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
// ---------------------------------------------------------------------------
// Staleness budget after an out-of-band reseed — the honest numbers.
//
// Nothing in the running app writes to Province / Ward. The data changes only
// by running a seed script (`pnpm db:seed:geography`) directly against a
// database, and there is no runtime hook that fires when that happens.
//
// A redeploy does NOT help: `unstable_cache` persists across deployments and
// serverless instances (Next 16 docs, "Migrating to Cache Components" §
// unstable_cache). Entries written before the deploy keep being served after
// it. So:
//
//   Data Cache layer .... up to CACHE_TTL.geography (24h) after the reseed
//   CDN layer ........... up to 24h fresh + 24h stale-while-revalidate on
//                         /api/geography/* (GEOGRAPHY_CACHE_CONTROL), and the
//                         response it holds was itself built from a Data Cache
//                         entry that may already have been up to 24h old
//
// Worst case a browser therefore sees geography up to ~72h behind the
// database. That is acceptable for this data (a province list that gains a row
// is not urgent) — but it is the real number, not "until the next deploy".
//
// To make a reseed visible promptly, in order of preference:
//   1. Bump CACHE_KEY_VERSION in lib/cache-tags.ts and deploy. New key ⇒ the
//      old entries are orphaned and these queries re-run. This is the
//      supported invalidation path for out-of-band data changes, and the only
//      one that survives the persistence described above.
//   2. Purge the CDN for /api/geography/* (Vercel dashboard / deployment
//      purge). Required in addition to (1): tag invalidation and cache keys
//      have no reach into a CDN.
//   3. `revalidateGeography()` (lib/cache.ts) clears the Data Cache tag, but
//      only works from a request-scoped context — there is no admin route
//      calling it today, so it is not usable from a seed script.
// ---------------------------------------------------------------------------

export const listProvinces = unstable_cache(
  async () =>
    db.province.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  [CACHE_KEY_VERSION, "geography", "provinces"],
  { tags: [CACHE_TAGS.geography], revalidate: CACHE_TTL.geography },
);

export const listWards = unstable_cache(
  async (provinceCode?: string) =>
    db.ward.findMany({
      where: provinceCode ? { province: { code: provinceCode } } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, provinceId: true },
    }),
  [CACHE_KEY_VERSION, "geography", "wards"],
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
  [CACHE_KEY_VERSION, "geography", "ward-by-id"],
  { tags: [CACHE_TAGS.geography], revalidate: CACHE_TTL.geography },
);
