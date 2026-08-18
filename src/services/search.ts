import type { ProfileCategory, Role } from "@prisma/client";

import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";

export type SortOption = "rating" | "price_asc" | "price_desc" | "newest" | "reviews";

export interface SearchParams {
  q?: string;
  roles?: Role[];
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  categories?: ProfileCategory[];
  minRating?: number;
  sort?: SortOption;
  page?: number;
  limit?: number;
}

const PAGE_SIZE_DEFAULT = 24;

export async function searchProfiles(params: SearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = params.limit ?? PAGE_SIZE_DEFAULT;

  const where = {
    isPublished: true,
    role: { in: params.roles && params.roles.length > 0 ? params.roles : PAID_ROLES },
    ...(params.city ? { user: { location: { equals: params.city, mode: "insensitive" as const } } } : {}),
    ...(params.categories && params.categories.length > 0
      ? { categories: { hasSome: params.categories } }
      : {}),
    ...(params.minPrice !== undefined ? { priceMax: { gte: params.minPrice } } : {}),
    ...(params.maxPrice !== undefined ? { priceMin: { lte: params.maxPrice } } : {}),
    ...(params.q
      ? {
          OR: [
            { displayName: { contains: params.q, mode: "insensitive" as const } },
            { description: { contains: params.q, mode: "insensitive" as const } },
            { shopName: { contains: params.q, mode: "insensitive" as const } },
            { user: { name: { contains: params.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const orderBy =
    params.sort === "price_asc"
      ? [{ priceMin: "asc" as const }]
      : params.sort === "price_desc"
        ? [{ priceMin: "desc" as const }]
        : params.sort === "newest"
          ? [{ createdAt: "desc" as const }]
          : undefined; // rating/reviews are computed in JS below (no denormalized column)

  const [profiles, total] = await Promise.all([
    db.profile.findMany({
      where,
      orderBy,
      skip: orderBy ? (page - 1) * limit : undefined,
      take: orderBy ? limit : undefined,
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true, location: true } },
        media: { orderBy: { order: "asc" }, take: 3 },
      },
    }),
    db.profile.count({ where }),
  ]);

  // Rating/review count aren't denormalized columns (see Step 3's note on
  // avoiding a trigger-maintained column at this scale) — compute per
  // profile's user from Review, then sort/filter/paginate in JS when the
  // sort or rating filter needs it.
  const userIds = profiles.map((p) => p.user.id);
  const reviewStats = await db.review.groupBy({
    by: ["reviewedId"],
    where: { reviewedId: { in: userIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const statsByUser = new Map(
    reviewStats.map((s) => [s.reviewedId, { avg: s._avg.rating ?? 0, count: s._count.rating }]),
  );

  let results = profiles.map((profile) => ({
    ...profile,
    avgRating: statsByUser.get(profile.user.id)?.avg ?? 0,
    reviewCount: statsByUser.get(profile.user.id)?.count ?? 0,
  }));

  if (params.minRating !== undefined) {
    results = results.filter((r) => r.avgRating >= params.minRating!);
  }

  if (!orderBy) {
    results = results.sort((a, b) =>
      params.sort === "reviews" ? b.reviewCount - a.reviewCount : b.avgRating - a.avgRating,
    );
  }

  const paginated = orderBy ? results : results.slice((page - 1) * limit, page * limit);
  const effectiveTotal = params.minRating !== undefined ? results.length : total;

  const [roleCounts, cityRows] = await Promise.all([
    db.profile.groupBy({
      by: ["role"],
      where: { isPublished: true, role: { in: PAID_ROLES } },
      _count: { role: true },
    }),
    db.user.findMany({
      where: { location: { not: null }, profiles: { some: { isPublished: true } } },
      select: { location: true },
      distinct: ["location"],
    }),
  ]);

  return {
    data: paginated,
    total: effectiveTotal,
    page,
    totalPages: Math.max(1, Math.ceil(effectiveTotal / limit)),
    facets: {
      roles: roleCounts.map((r) => ({ role: r.role, count: r._count.role })),
      cities: cityRows.map((c) => c.location).filter((c): c is string => Boolean(c)),
    },
  };
}
