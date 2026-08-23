import { NextResponse } from "next/server";

import type { ProductCondition } from "@prisma/client";
import { features } from "@/lib/features";
import { searchProducts } from "@/services/marketplace";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function GET(request: Request) {
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  const category = searchParams.getAll("category");
  const condition = searchParams.getAll("condition") as ProductCondition[];
  const priceMin = searchParams.get("priceMin");
  const priceMax = searchParams.get("priceMax");
  const sort = searchParams.get("sort");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const result = await searchProducts({
    type: type === "SALE" || type === "RENT" ? type : undefined,
    category: category.length ? category : undefined,
    condition: condition.length ? condition : undefined,
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
    inStockOnly: searchParams.get("inStockOnly") === "true",
    sort: sort === "price_asc" || sort === "price_desc" ? sort : "newest",
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
