import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/cards/product-card";
import {
  FilterParamsProvider,
  FilterResultsPane,
} from "@/components/filters/filter-params-provider";
import { GearIcon } from "@/components/shop/gear-icon";
import { ShopQuickBar } from "@/components/shop/shop-quick-bar";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { cn } from "@/lib/utils";
import { searchProducts } from "@/services/marketplace";

interface ShopPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata() {
  const t = await getTranslations("publicPages.shop");
  return { title: `${t("heading")} — Fgrapher` };
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  if (!features.marketplaceEnabled) {
    notFound();
  }

  const t = await getTranslations("publicPages.shop");
  const categoryT = await getTranslations("productCategory");
  const params = await searchParams;

  const type =
    params.type === "SALE" || params.type === "RENT" ? params.type : undefined;
  const category = params.category?.split(",").filter(Boolean);
  const condition = params.condition?.split(",").filter(Boolean) as
    ("NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "AVERAGE")[] | undefined;
  const sort =
    params.sort === "price_asc" || params.sort === "price_desc"
      ? params.sort
      : "newest";
  const page = params.page ? Number(params.page) : 1;

  // Seller areas for the location filter. Provinces are seeded reference
  // data (CLAUDE.md rule 9 — never hardcode them in a component).
  const provinces = await db.province.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const result = await searchProducts({
    q: params.q,
    sellerId: params.sellerId || undefined,
    type,
    category,
    condition,
    priceMin: params.priceMin ? Number(params.priceMin) : undefined,
    priceMax: params.priceMax ? Number(params.priceMax) : undefined,
    inStockOnly: params.inStockOnly === "true",
    provinceId: params.provinceId || undefined,
    wardId: params.wardId || undefined,
    sort,
    page,
  });

  const categoryCounts = Object.fromEntries(
    result.facets.categories.map((c) => [c.category, c.count]),
  );

  const sortLabel =
    sort === "price_asc"
      ? t("filters.sortPriceAsc")
      : sort === "price_desc"
        ? t("filters.sortPriceDesc")
        : t("filters.sortNewest");

  // The five big tiles (wave 2): the equipment kinds people come for, each
  // with its line icon and a frame number. "Other" stays in the drawer.
  const TILES = ["Camera body", "Lens", "Lighting", "Audio", "Support"];
  const activeCategories = category ?? [];
  const tileHref = (value: string | null) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(
        (entry): entry is [string, string] =>
          Boolean(entry[1]) && entry[0] !== "category" && entry[0] !== "page",
      ),
    );
    if (value) next.set("category", value);
    const qs = next.toString();
    return qs ? `/shop?${qs}` : "/shop";
  };
  const activeCount = [
    params.q,
    category?.length,
    condition?.length,
    params.priceMin,
    params.priceMax,
    params.inStockOnly,
    params.provinceId,
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-[clamp(28px,4vw,56px)] pb-[72px] sm:px-8">
      <FilterParamsProvider>
        {/* No intro block (owner, 10/10/2026): the categories and listings
            explain themselves. */}
        <h1 className="sr-only">
          {type === "RENT" ? t("v2.titleRent") : t("v2.title")}
        </h1>

        <nav
          aria-label={t("filters.category")}
          className="grid grid-cols-5 gap-2 max-md:-mx-4 max-md:flex max-md:overflow-x-auto max-md:px-4 sm:gap-3"
        >
          {TILES.map((value) => {
            const active = activeCategories.includes(value);
            return (
              <Link
                key={value}
                href={tileHref(active ? null : value)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "focus-ring group flex min-w-[132px] flex-col justify-between gap-6 rounded-[var(--fg-radius-md)] border p-4 transition-colors duration-[var(--fg-dur-150)]",
                  active
                    ? "border-brand-primary bg-bg-surface shadow-[inset_0_0_0_1px_var(--brand-primary)]"
                    : "border-border-subtle bg-bg-surface hover:border-border-strong",
                )}
              >
                <GearIcon
                  category={value}
                  className="size-8 text-text-secondary group-hover:text-text-primary"
                />
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-body-md font-semibold! text-text-primary">
                    {categoryT(value)}
                  </span>
                  <span className="font-mono text-meta tabular-nums text-text-tertiary">
                    {categoryCounts[value] ?? 0}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6">
          <ShopQuickBar
            categoryCounts={categoryCounts}
            provinces={provinces}
            activeCount={activeCount}
          />
        </div>

        <div className="mt-6 min-w-0">
          <p className="mb-5 font-mono text-meta tracking-[0.12em] text-text-tertiary uppercase">
            {t("count", { count: result.total, sort: sortLabel })}
          </p>
          <FilterResultsPane label={t("updatingResults")}>
            {result.data.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <SearchX className="size-12 text-text-tertiary" />
                <p className="text-body-lg font-semibold! text-text-primary">
                  {t("emptyTitle")}
                </p>
                <p className="text-body-md text-text-secondary">
                  {t("emptyBody")}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/shop" />}
                >
                  {t("clearAll")}
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-5 gap-y-9 max-sm:gap-x-3 md:grid-cols-3 xl:grid-cols-4">
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
                        {t("prev")}
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
                        {t("next")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </FilterResultsPane>
        </div>
      </FilterParamsProvider>
    </div>
  );
}
