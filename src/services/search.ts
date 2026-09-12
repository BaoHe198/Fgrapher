import type {
  ExperienceLevel,
  Prisma,
  ProfileCategory,
  Role,
} from "@prisma/client";

import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";
import {
  CACHE_KEY_VERSION,
  CACHE_TAGS,
  CACHE_TTL,
  reviveDates,
  unstable_cache,
} from "@/lib/cache";

// QA: /browse results and facets included CAMERA_SHOP even with the
// marketplace off (features.marketplaceEnabled=false) — this file used
// the raw PAID_ROLES constant everywhere instead of excluding the one
// role that's dormant behind that flag (see CLAUDE.md's MVP scope).
// Computed once at module load, same pattern already used client-side
// in hero-search.tsx/filter-sidebar.tsx.
const SEARCHABLE_ROLES = features.marketplaceEnabled
  ? PAID_ROLES
  : PAID_ROLES.filter((role) => role !== "CAMERA_SHOP");

export type SortOption =
  "rating" | "price_asc" | "price_desc" | "newest" | "reviews";

export interface SearchParams {
  q?: string;
  roles?: Role[];
  city?: string;
  wardId?: string;
  minPrice?: number;
  maxPrice?: number;
  categories?: ProfileCategory[];
  minRating?: number;
  sort?: SortOption;
  page?: number;
  limit?: number;
  // Model-specific filters — only meaningful when `roles` is scoped to
  // exactly ["MODEL"] (the UI only reveals these when a single Model
  // filter is active, since combining them with other roles would wrongly
  // exclude every non-Model profile, whose these fields are always null).
  heightMin?: number;
  heightMax?: number;
  experienceLevel?: ExperienceLevel[];
  travelWilling?: boolean;
}

const PAGE_SIZE_DEFAULT = 24;

// Publish state alone is not enough to be public: a suspended or soft-deleted
// account keeps its `isPublished` Profile rows, so every public Profile query
// here (and the featured strip, and getPublicProfileUser) must also require a
// live owning user. Applied as a relation filter on `Profile.user`.
export const PUBLIC_USER_FILTER = {
  deletedAt: null,
  isSuspended: false,
} as const;

const PROVIDER_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      location: true,
    },
  },
  // Prompt B5, VIỆC 5 — public search must never surface unmoderated
  // media, same rule as public-profile.ts's getPublicProfileUser.
  // Prompt G5, VIỆC 3 — the card carousel shows up to 5 photos; per
  // profile here (groupProfilesByUser then slices the merged total to 5
  // too, since one person can hold several role-profiles).
  media: {
    where: { moderationStatus: "APPROVED" as const },
    orderBy: { order: "asc" as const },
    take: 5,
  },
};

type ProviderProfile = Prisma.ProfileGetPayload<{
  include: typeof PROVIDER_INCLUDE;
}>;

/**
 * One provider (User) can hold several published Profile rows, one per role
 * (PHOTOGRAPHER, VIDEOGRAPHER, ...). Search results and the landing page's
 * featured strip must show one card per person, not one per role — so every
 * query here fetches Profile rows and then collapses them onto their shared
 * userId before pagination/sorting, using the lowest priceMin across roles
 * and the union of media/role badges.
 */
function groupProfilesByUser(
  profiles: ProviderProfile[],
  statsByUser: Map<string, { avg: number; count: number }>,
) {
  const byUser = new Map<string, ProviderProfile[]>();
  for (const profile of profiles) {
    const existing = byUser.get(profile.userId);
    if (existing) {
      existing.push(profile);
    } else {
      byUser.set(profile.userId, [profile]);
    }
  }

  return Array.from(byUser.values()).map((rawUserProfiles) => {
    // PAID_ROLES order (Photographer, Videographer, ...) rather than
    // insertion order, so a person's role badges/tabs are consistent
    // regardless of which profile they created first.
    const userProfiles = [...rawUserProfiles].sort(
      (a, b) => PAID_ROLES.indexOf(a.role) - PAID_ROLES.indexOf(b.role),
    );
    const stats = statsByUser.get(userProfiles[0].userId) ?? {
      avg: 0,
      count: 0,
    };
    const priceMin = userProfiles.reduce<number | null>(
      (min, p) =>
        p.priceMin != null && (min === null || p.priceMin < min)
          ? p.priceMin
          : min,
      null,
    );
    const createdAt = userProfiles.reduce(
      (latest, p) => (p.createdAt > latest ? p.createdAt : latest),
      userProfiles[0].createdAt,
    );

    return {
      userId: userProfiles[0].userId,
      user: userProfiles[0].user,
      roles: userProfiles.map((p) => p.role),
      displayName: userProfiles.find((p) => p.displayName)?.displayName ?? null,
      priceMin,
      currency: userProfiles[0].currency,
      media: userProfiles.flatMap((p) => p.media).slice(0, 5),
      avgRating: stats.avg,
      reviewCount: stats.count,
      createdAt,
      // Prompt B4 VIỆC 4 — true if ANY of this person's matching profiles
      // takes bookings nationwide, so the browse card can show the badge
      // regardless of which specific role/profile matched the search.
      servesNationwide: userProfiles.some((p) => p.servesNationwide),
    };
  });
}

export type ProviderCard = ReturnType<typeof groupProfilesByUser>[number];

// Nationwide-serving providers shown as a supplementary section under a
// thin province-scoped result — not paginated, just a small backfill list.
const NATIONWIDE_SECTION_SIZE = 6;
// Only shown when the province-scoped result is this thin (Prompt B4
// VIỆC 4's "kết quả chính < 5").
const NATIONWIDE_SECTION_THRESHOLD = 5;

function buildBaseWhere(params: SearchParams): Prisma.ProfileWhereInput {
  // Also clamps an explicit ?roles=CAMERA_SHOP (a direct URL edit, not
  // just the UI's own role picker, which already omits that option) down
  // while the marketplace is off, rather than trusting it — but only
  // falls back to "every searchable role" when no roles filter was given
  // at all. If one *was* given and none of it survives the clamp (e.g.
  // ?roles=CAMERA_SHOP alone), `in: []` correctly matches nothing rather
  // than silently showing every provider instead.
  const requestedRoles =
    params.roles && params.roles.length > 0
      ? params.roles.filter((role) =>
          (SEARCHABLE_ROLES as Role[]).includes(role),
        )
      : undefined;
  return {
    isPublished: true,
    user: PUBLIC_USER_FILTER,
    role: {
      in: requestedRoles ?? SEARCHABLE_ROLES,
    },
    ...(params.categories && params.categories.length > 0
      ? { categories: { hasSome: params.categories } }
      : {}),
    ...(params.minPrice !== undefined
      ? { priceMax: { gte: params.minPrice } }
      : {}),
    ...(params.maxPrice !== undefined
      ? { priceMin: { lte: params.maxPrice } }
      : {}),
    ...(params.heightMin !== undefined || params.heightMax !== undefined
      ? {
          height: {
            ...(params.heightMin !== undefined
              ? { gte: params.heightMin }
              : {}),
            ...(params.heightMax !== undefined
              ? { lte: params.heightMax }
              : {}),
          },
        }
      : {}),
    ...(params.experienceLevel && params.experienceLevel.length > 0
      ? { experienceLevel: { in: params.experienceLevel } }
      : {}),
    ...(params.travelWilling ? { travelWilling: true } : {}),
    ...(params.q
      ? {
          OR: [
            {
              displayName: { contains: params.q, mode: "insensitive" as const },
            },
            {
              description: { contains: params.q, mode: "insensitive" as const },
            },
            { shopName: { contains: params.q, mode: "insensitive" as const } },
            {
              user: {
                name: { contains: params.q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };
}

/**
 * Runs one `where` clause through the shared match -> hydrate -> rate ->
 * sort pipeline. Used for both the primary (province-scoped or unscoped)
 * result set and the nationwide backfill section, which differ only in
 * their `where` clause and how many rows the caller keeps.
 */
async function resolveProviderCards(
  where: Prisma.ProfileWhereInput,
  sort: SortOption | undefined,
  minRating: number | undefined,
  excludeUserIds?: string[],
) {
  // A user matches if ANY of their profiles satisfies the filters above
  // (role included) — find those first, then pull in the rest of that
  // user's published profiles so the card can show every active role, not
  // just the one that happened to match.
  const matches = await db.profile.findMany({
    where,
    select: { userId: true },
  });
  const excludeSet = new Set(excludeUserIds ?? []);
  const matchedUserIds = Array.from(
    new Set(matches.map((m) => m.userId).filter((id) => !excludeSet.has(id))),
  );

  // Independent once matchedUserIds is known — run together rather than
  // waiting on `profiles` before starting the review-stats query.
  const [profiles, reviewStats] = matchedUserIds.length
    ? await Promise.all([
        db.profile.findMany({
          where: {
            isPublished: true,
            user: PUBLIC_USER_FILTER,
            role: { in: SEARCHABLE_ROLES },
            userId: { in: matchedUserIds },
          },
          include: PROVIDER_INCLUDE,
        }),
        // Rating/review count aren't denormalized columns (see Step 3's
        // note on avoiding a trigger-maintained column at this scale) —
        // Review.reviewedId points at the User, so this is naturally
        // already per-person, not per-role.
        db.review.groupBy({
          by: ["reviewedId"],
          where: { reviewedId: { in: matchedUserIds } },
          _avg: { rating: true },
          _count: { rating: true },
        }),
      ])
    : [[], []];
  const statsByUser = new Map(
    reviewStats.map((s) => [
      s.reviewedId,
      { avg: s._avg.rating ?? 0, count: s._count.rating },
    ]),
  );

  let results = groupProfilesByUser(profiles, statsByUser);

  if (minRating !== undefined) {
    results = results.filter((r) => r.avgRating >= minRating);
  }

  return results.sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return (a.priceMin ?? Infinity) - (b.priceMin ?? Infinity);
      case "price_desc":
        return (b.priceMin ?? -Infinity) - (a.priceMin ?? -Infinity);
      case "newest":
        return b.createdAt.getTime() - a.createdAt.getTime();
      case "reviews":
        return b.reviewCount - a.reviewCount;
      default:
        return b.avgRating - a.avgRating;
    }
  });
}

async function searchProfilesUncached(params: SearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = params.limit ?? PAGE_SIZE_DEFAULT;

  // Global facet-count query (role filter badges) — doesn't depend on
  // `params` at all, so it's kicked off here and only awaited once it's
  // actually needed below, letting it run alongside everything else
  // instead of queuing up after the filtered results resolve.
  const roleRowsPromise = db.profile.findMany({
    where: {
      isPublished: true,
      user: PUBLIC_USER_FILTER,
      role: { in: SEARCHABLE_ROLES },
    },
    select: { role: true, userId: true, categories: true },
  });

  // `city` carries a Province.code (Prompt B4) — the browse filter's
  // dropdown is populated straight from services/geography.ts's real
  // Province rows, not a hardcoded list (CLAUDE.md mục 9).
  const province = params.city
    ? await db.province.findUnique({ where: { code: params.city } })
    : null;

  const baseWhere = buildBaseWhere(params);
  const withProvince: Prisma.ProfileWhereInput = province
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { provinceId: province.id },
              { serviceAreas: { some: { provinceId: province.id } } },
            ],
          },
        ],
      }
    : baseWhere;

  // Ward is strictly more specific than a service area (ProfileServiceArea
  // has no ward granularity). A provider with no wardId set isn't known to
  // be *outside* the searched ward — the field is optional and plenty of
  // real providers (e.g. ones who roam an entire city) never set it — so
  // excluding them entirely on a ward search produced false negatives.
  // Keep exact-ward matches first-class, but don't drop ward-unset
  // providers who already matched on province.
  const primaryWhere: Prisma.ProfileWhereInput = params.wardId
    ? {
        AND: [
          withProvince,
          { OR: [{ wardId: params.wardId }, { wardId: null }] },
        ],
      }
    : withProvince;

  const results = await resolveProviderCards(
    primaryWhere,
    params.sort,
    params.minRating,
  );

  const effectiveTotal = results.length;
  const paginated = results.slice((page - 1) * limit, page * limit);

  // Prompt B4 VIỆC 4 — "xử lý mật độ không đều": when a province filter is
  // active and the scoped result is thin, backfill with nationwide-serving
  // providers in a clearly separate section (never merged into `data`).
  let nationwide: ProviderCard[] = [];
  if (province && effectiveTotal < NATIONWIDE_SECTION_THRESHOLD) {
    const nationwideWhere: Prisma.ProfileWhereInput = {
      AND: [baseWhere, { servesNationwide: true }],
    };
    const nationwideResults = await resolveProviderCards(
      nationwideWhere,
      params.sort,
      params.minRating,
      results.map((r) => r.userId),
    );
    nationwide = nationwideResults.slice(0, NATIONWIDE_SECTION_SIZE);
  }

  const roleRows = await roleRowsPromise;

  // Count unique providers per role, not profile rows — a role's Profile
  // rows already map 1:1 to users for that role (Profile has a
  // @@unique([userId, role]) constraint), but building the set explicitly
  // keeps this correct even if that assumption ever changes.
  const usersByRole = new Map<Role, Set<string>>();
  // Prompt G4, VIỆC 2 — "hiện số lượng provider theo từng thể loại" /
  // "0 provider thì làm mờ hoặc ẩn". Global counts, not scoped to the
  // current filter selection (same choice roleCounts already makes) —
  // category values are disjoint per role group (see CATEGORIES_BY_ROLE),
  // so there's no cross-role ambiguity in counting them together.
  const usersByCategory = new Map<ProfileCategory, Set<string>>();
  for (const row of roleRows) {
    const roleSet = usersByRole.get(row.role) ?? new Set<string>();
    roleSet.add(row.userId);
    usersByRole.set(row.role, roleSet);

    for (const category of row.categories) {
      const categorySet = usersByCategory.get(category) ?? new Set<string>();
      categorySet.add(row.userId);
      usersByCategory.set(category, categorySet);
    }
  }

  return {
    data: paginated,
    nationwide,
    total: effectiveTotal,
    page,
    totalPages: Math.max(1, Math.ceil(effectiveTotal / limit)),
    // Resolved from params.city (a Province.code) — callers use this to
    // display the real province name and, for the empty-state waitlist
    // form, its id (Prompt B4 VIỆC 4).
    province: province ? { id: province.id, name: province.name } : null,
    facets: {
      roles: SEARCHABLE_ROLES.map((role) => ({
        role,
        count: usersByRole.get(role)?.size ?? 0,
      })),
      categories: Object.fromEntries(
        Array.from(usersByCategory.entries()).map(([category, users]) => [
          category,
          users.size,
        ]),
      ) as Partial<Record<ProfileCategory, number>>,
    },
  };
}

// A canonical string for the params object so `unstable_cache`'s key is
// deterministic regardless of the order callers happen to build the object
// in (the API route and the /browse page build it differently). Undefined
// fields are dropped; keys are sorted.
function canonicalParamsKey(params: SearchParams): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(Object.fromEntries(entries));
}

const searchProfilesCached = unstable_cache(
  (key: string) => searchProfilesUncached(JSON.parse(key) as SearchParams),
  [CACHE_KEY_VERSION, "search", "profiles"],
  { tags: [CACHE_TAGS.search], revalidate: CACHE_TTL.search },
);

/**
 * Public search. Cached in the Data Cache for ~90s, keyed by the (canonical)
 * filter set, tagged `search` so any mutation that can move a profile in or
 * out of results invalidates it (see revalidatePublicProfile /
 * revalidateSearch). Fully public — never fed a session or per-user value.
 */
export async function searchProfiles(params: SearchParams) {
  return reviveDates(await searchProfilesCached(canonicalParamsKey(params)));
}

/**
 * A review only counts toward the featured strip if the person it is *about*
 * is themselves eligible to appear there: a live (not suspended, not
 * soft-deleted) account holding at least one published profile in a searchable
 * role.
 *
 * This must constrain the `groupBy` itself, not only the `findMany` after it.
 * `groupBy` applies `take` after ordering by average rating, so filtering
 * afterwards let an ineligible high-rated user — unpublished, suspended,
 * soft-deleted, CUSTOMER-only, or holding a role that is not searchable while
 * the marketplace flag is off — consume one of the `limit` slots and produce
 * no card. Worse, an eligible rated provider ranked just below the cutoff was
 * never considered at all: the slot fell through to the "newest published"
 * backfill, which orders by createdAt, so the strip quietly degraded from
 * "top rated" to "newest" while genuinely rated providers existed.
 */
export const FEATURED_RATED_PROVIDER_WHERE = {
  reviewed: {
    ...PUBLIC_USER_FILTER,
    profiles: {
      some: { isPublished: true, role: { in: SEARCHABLE_ROLES } },
    },
  },
} satisfies Prisma.ReviewWhereInput;

/**
 * Top-rated published providers for the landing page's "Featured near you"
 * section, backfilled with the newest published providers when there aren't
 * enough reviewed ones yet — never pads with fake data.
 */
// The landing page's featured strip is a shop window for a portfolio
// marketplace: a card with nothing to show sells nobody. Providers with no
// approved photo are excluded outright rather than padded in — the strip
// showing three of four cards reading "no portfolio yet" was the first
// thing a visitor saw.
const HAS_APPROVED_MEDIA = {
  some: { moderationStatus: "APPROVED", deletedAt: null },
} satisfies Prisma.ProfileMediaListRelationFilter;

async function getFeaturedProfilesUncached(limit = 4) {
  // A groupBy only returns groups that have at least one row, so every
  // entry here already has reviewCount >= 1. reviewedId is a User, so this
  // is already deduplicated by person, not by role. The `where` restricts the
  // ranking to providers who can actually be shown, so `take` spends all
  // `limit` slots on real candidates — see FEATURED_RATED_PROVIDER_WHERE.
  const rated = await db.review.groupBy({
    by: ["reviewedId"],
    where: FEATURED_RATED_PROVIDER_WHERE,
    _avg: { rating: true },
    _count: { rating: true },
    orderBy: { _avg: { rating: "desc" } },
    take: limit,
  });

  const statsByUser = new Map(
    rated.map((r) => [
      r.reviewedId,
      { avg: r._avg.rating ?? 0, count: r._count.rating },
    ]),
  );

  const ratedProfiles = rated.length
    ? await db.profile.findMany({
        where: {
          isPublished: true,
          user: PUBLIC_USER_FILTER,
          role: { in: SEARCHABLE_ROLES },
          userId: { in: rated.map((r) => r.reviewedId) },
          media: HAS_APPROVED_MEDIA,
        },
        include: PROVIDER_INCLUDE,
      })
    : [];

  let featured = groupProfilesByUser(ratedProfiles, statsByUser).sort(
    (a, b) => b.avgRating - a.avgRating,
  );

  if (featured.length < limit) {
    const excludeUserIds = featured.map((p) => p.userId);
    const needed = limit - featured.length;
    // Over-fetch: a user can have up to one profile per SEARCHABLE_ROLES
    // entry, so grouping this batch by user may yield fewer than `needed`
    // new people.
    const fallbackProfiles = await db.profile.findMany({
      where: {
        isPublished: true,
        user: PUBLIC_USER_FILTER,
        role: { in: SEARCHABLE_ROLES },
        userId: excludeUserIds.length ? { notIn: excludeUserIds } : undefined,
        media: HAS_APPROVED_MEDIA,
      },
      orderBy: { createdAt: "desc" },
      take: needed * SEARCHABLE_ROLES.length,
      include: PROVIDER_INCLUDE,
    });
    const fallback = groupProfilesByUser(fallbackProfiles, new Map())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, needed);
    featured = [...featured, ...fallback];
  }

  return featured;
}

const getFeaturedProfilesCached = unstable_cache(
  (limit: number) => getFeaturedProfilesUncached(limit),
  [CACHE_KEY_VERSION, "search", "featured"],
  { tags: [CACHE_TAGS.search], revalidate: CACHE_TTL.featured },
);

/**
 * Cached (~10m, tag `search`) wrapper around the featured strip. Public,
 * visitor-independent. Invalidated alongside search results by any profile /
 * review / verification mutation.
 */
export async function getFeaturedProfiles(limit = 4) {
  return reviveDates(await getFeaturedProfilesCached(limit));
}
