import type { ProfileCategory, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { searchProfiles, type SortOption } from "@/services/search";

const VALID_SORTS: SortOption[] = [
  "rating",
  "price_asc",
  "price_desc",
  "newest",
  "reviews",
];

// Fully public, no auth gate (by design — search has to work for
// anonymous visitors), and every call runs several DB queries
// (services/search.ts's searchProfiles). Generous enough for real
// browsing (rapid filter changes can fire a handful of calls in a burst)
// but caps a scripted scraping/DoS loop, which had no resistance before.
const SEARCH_RATE_LIMIT = { max: 60, windowMs: 60 * 1000 };

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`search:${ip}`, SEARCH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") ?? undefined;
  const roles = searchParams.get("roles")?.split(",").filter(Boolean) as
    Role[] | undefined;
  const city = searchParams.get("city") ?? undefined;
  const minPrice = searchParams.get("minPrice")
    ? Number(searchParams.get("minPrice"))
    : undefined;
  const maxPrice = searchParams.get("maxPrice")
    ? Number(searchParams.get("maxPrice"))
    : undefined;
  const categories = searchParams
    .get("categories")
    ?.split(",")
    .filter(Boolean) as ProfileCategory[] | undefined;
  const minRating = searchParams.get("minRating")
    ? Number(searchParams.get("minRating"))
    : undefined;
  const sortParam = searchParams.get("sort");
  const sort = VALID_SORTS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : "rating";
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;

  const result = await searchProfiles({
    q,
    roles,
    city,
    minPrice,
    maxPrice,
    categories,
    minRating,
    sort,
    page,
  });

  return NextResponse.json(
    {
      data: result.data,
      nationwide: result.nationwide,
      province: result.province,
      error: null,
      message: null,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
      facets: result.facets,
    },
    { status: 200 },
  );
}
