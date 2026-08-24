import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ArtistCard } from "@/components/cards/artist-card";
import { BrowseFilterProvider } from "@/components/browse/browse-filter-context";
import { FilterSidebar } from "@/components/browse/filter-sidebar";
import { MobileFilterSheet } from "@/components/browse/mobile-filter-sheet";
import { ResultsPane } from "@/components/browse/results-pane";
import { SearchInput } from "@/components/browse/search-input";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { ROLE_LABELS } from "@/lib/constants";
import { features } from "@/lib/features";
import { formatCurrency } from "@/lib/utils";
import { searchProfiles, type SortOption } from "@/services/search";

interface BrowsePageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata() {
  const t = await getTranslations("publicPages.browse");
  return { title: t("pageTitle") };
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const t = await getTranslations("publicPages.browse");
  const SORT_LABELS: Record<string, string> = {
    rating: t("sortLabels.rating"),
    price_asc: t("sortLabels.priceAsc"),
    price_desc: t("sortLabels.priceDesc"),
    newest: t("sortLabels.newest"),
    reviews: t("sortLabels.reviews"),
  };

  const params = await searchParams;

  const roles = params.roles?.split(",").filter(Boolean) as Role[] | undefined;
  const categories = params.categories?.split(",").filter(Boolean) as
    ProfileCategory[] | undefined;
  const sort = (params.sort as SortOption) ?? "rating";
  const page = params.page ? Number(params.page) : 1;

  const experienceLevel = params.experienceLevel?.split(",").filter(Boolean) as
    ExperienceLevel[] | undefined;

  const result = await searchProfiles({
    q: params.q,
    roles,
    city: params.city,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    categories,
    minRating: params.minRating ? Number(params.minRating) : undefined,
    heightMin: params.heightMin ? Number(params.heightMin) : undefined,
    heightMax: params.heightMax ? Number(params.heightMax) : undefined,
    experienceLevel,
    travelWilling: params.travelWilling === "1",
    sort,
    page,
  });

  const roleCounts = Object.fromEntries(
    result.facets.roles.map((r) => [r.role, r.count]),
  );

  const activeFilterCount = [
    roles?.length,
    params.city,
    params.minPrice,
    params.maxPrice,
    params.minRating,
  ].filter(Boolean).length;

  const heading =
    roles && roles.length === 1 && params.city
      ? t("headingWithRoleCity", {
          role: ROLE_LABELS[roles[0]],
          city: params.city,
        })
      : t("headingDefault");

  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-8 pb-[72px] sm:px-8">
      <BrowseFilterProvider>
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[268px_1fr]">
          <div className="hidden lg:block">
            <FilterSidebar
              roleCounts={roleCounts}
              marketplaceEnabled={features.marketplaceEnabled}
            />
          </div>

          <div className="min-w-0">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-display-md text-text-primary">{heading}</h1>
                <p className="text-body-md text-text-secondary">
                  {t("resultsCount", {
                    count: result.total,
                    sort: SORT_LABELS[sort],
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SearchInput className="w-full sm:w-64" />
                <div className="lg:hidden">
                  <MobileFilterSheet
                    roleCounts={roleCounts}
                    activeCount={activeFilterCount}
                    marketplaceEnabled={features.marketplaceEnabled}
                  />
                </div>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <Tag
                selected={params.availableNow === "1"}
                render={<Link href="?availableNow=1" />}
              >
                {t("filterAvailableNow")}
              </Tag>
              <Tag
                selected={params.instantBook === "1"}
                render={<Link href="?instantBook=1" />}
              >
                {t("filterInstantBook")}
              </Tag>
              <Tag
                selected={sort === "rating"}
                render={<Link href="?sort=rating" />}
              >
                {t("filterTopRated")}
              </Tag>
            </div>

            <ResultsPane>
              {result.data.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <SearchX className="size-12 text-text-tertiary" />
                  <p className="text-body-lg font-semibold text-text-primary">
                    {t("noResults.heading")}
                  </p>
                  <p className="text-body-md text-text-secondary">
                    {t("noResults.body")}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/browse" />}
                  >
                    {t("clearFilters")}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {result.data.map((profile) => (
                      <ArtistCard
                        key={profile.userId}
                        artist={{
                          id: profile.userId,
                          name:
                            profile.displayName ??
                            profile.user.name ??
                            t("unnamed"),
                          username: profile.user.username ?? "",
                          roles: profile.roles.map((role) => ROLE_LABELS[role]),
                          city: profile.user.location ?? "",
                          rating:
                            profile.avgRating > 0
                              ? profile.avgRating.toFixed(1)
                              : t("newBadge"),
                          reviews: profile.reviewCount,
                          price: profile.priceMin
                            ? t("priceFrom", {
                                price: formatCurrency(profile.priceMin),
                              })
                            : t("contactForPricing"),
                          coverImage: profile.media[0]?.url,
                        }}
                      />
                    ))}
                  </div>

                  <p className="mt-6 text-center text-body-sm text-text-tertiary">
                    {t("showingResults", {
                      shown: result.data.length,
                      total: result.total,
                    })}
                  </p>

                  {result.totalPages > 1 ? (
                    <div className="mt-4 flex justify-center gap-2">
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
                          {t("previous")}
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
                          {t("loadMore")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </ResultsPane>
          </div>
        </div>
      </BrowseFilterProvider>
    </div>
  );
}
