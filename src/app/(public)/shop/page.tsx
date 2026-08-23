import { SearchX } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/cards/product-card";
import { ShopFilters } from "@/components/shop/shop-filters";
import { Button } from "@/components/ui/button";
import { features } from "@/lib/features";
import { searchProducts } from "@/services/marketplace";

interface ShopPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Camera gear — Fgrapher" };

export default async function ShopPage({ searchParams }: ShopPageProps) {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  const params = await searchParams;

  const type =
    params.type === "SALE" || params.type === "RENT" ? params.type : undefined;
  const category = params.category?.split(",").filter(Boolean);
  const condition = params.condition?.split(",").filter(Boolean) as
    ("NEW" | "LIKE_NEW" | "GOOD" | "FAIR")[] | undefined;
  const sort =
    params.sort === "price_asc" || params.sort === "price_desc"
      ? params.sort
      : "newest";
  const page = params.page ? Number(params.page) : 1;

  const result = await searchProducts({
    type,
    category,
    condition,
    priceMin: params.priceMin ? Number(params.priceMin) : undefined,
    priceMax: params.priceMax ? Number(params.priceMax) : undefined,
    inStockOnly: params.inStockOnly === "true",
    sort,
    page,
  });

  const categoryCounts = Object.fromEntries(
    result.facets.categories.map((c) => [c.category, c.count]),
  );

  const sortLabel =
    sort === "price_asc"
      ? "Price: low to high"
      : sort === "price_desc"
        ? "Price: high to low"
        : "Newest";

  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-8 pb-[72px] sm:px-8">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[268px_1fr]">
        <div className="hidden lg:block">
          <ShopFilters categoryCounts={categoryCounts} />
        </div>

        <div className="min-w-0">
          <div className="mb-5">
            <h1 className="text-display-md text-text-primary">Camera gear</h1>
            <p className="text-body-md text-text-secondary">
              {result.total} items · {sortLabel}
            </p>
          </div>

          {result.data.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <SearchX className="size-12 text-text-tertiary" />
              <p className="text-body-lg font-semibold text-text-primary">
                No gear found
              </p>
              <p className="text-body-md text-text-secondary">
                Try adjusting your filters.
              </p>
              <Button
                variant="secondary"
                size="sm"
                nativeButton={false}
                render={<Link href="/shop" />}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {result.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {result.totalPages > 1 ? (
                <div className="mt-6 flex justify-center gap-2">
                  {page > 1 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link
                          href={`?${new URLSearchParams({ ...params, page: String(page - 1) } as Record<string, string>).toString()}`}
                        />
                      }
                    >
                      Previous
                    </Button>
                  ) : null}
                  {page < result.totalPages ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link
                          href={`?${new URLSearchParams({ ...params, page: String(page + 1) } as Record<string, string>).toString()}`}
                        />
                      }
                    >
                      Load more
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
