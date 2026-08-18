import type { ProfileCategory, Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { searchProfiles, type SortOption } from "@/services/search";

const VALID_SORTS: SortOption[] = ["rating", "price_asc", "price_desc", "newest", "reviews"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q") ?? undefined;
  const roles = searchParams.get("roles")?.split(",").filter(Boolean) as Role[] | undefined;
  const city = searchParams.get("city") ?? undefined;
  const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const categories = searchParams.get("categories")?.split(",").filter(Boolean) as
    | ProfileCategory[]
    | undefined;
  const minRating = searchParams.get("minRating") ? Number(searchParams.get("minRating")) : undefined;
  const sortParam = searchParams.get("sort");
  const sort = VALID_SORTS.includes(sortParam as SortOption) ? (sortParam as SortOption) : "rating";
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
