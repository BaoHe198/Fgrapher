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
import { WaitlistForm } from "@/components/browse/waitlist-form";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { features } from "@/lib/features";
import { formatCurrency } from "@/lib/utils";
import { searchProfiles, type SortOption } from "@/services/search";

interface BrowsePageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

// Prompt G4, VIỆC 5 — "gợi ý cụ thể nên bỏ tiêu chí nào" instead of just a
// generic "no results" message. Builds a link back to the current filter
// state minus one param at a time.
function queryWithout(
  params: Record<string, string | undefined>,
  keysToDrop: string[],
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && !keysToDrop.includes(key)) next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

export async function generateMetadata() {
  const t = await getTranslations("publicPages.browse");
  return { title: t("pageTitle") };
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const t = await getTranslations("publicPages.browse");
  const roleT = await getTranslations("role");
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
    wardId: params.ward,
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
  const categoryCounts = result.facets.categories;

  // Each entry: a translated label for the active criterion + the keys to
  // drop from the URL to remove just that one. Order roughly matches how
  // restrictive each filter tends to be (categories/budget/rating first —
  // the ones most likely to zero out results — before broader ones).
  const removableFilters: { key: string; label: string; drop: string[] }[] = [
    ...(categories && categories.length > 0
      ? [
          {
            key: "categories",
            label: t("noResults.removeCategories"),
            drop: ["categories"],
          },
        ]
      : []),
    ...(params.minPrice || params.maxPrice
      ? [
          {
            key: "budget",
            label: t("noResults.removeBudget"),
            drop: ["minPrice", "maxPrice"],
          },
        ]
      : []),
    ...(params.minRating
      ? [
          {
            key: "rating",
            label: t("noResults.removeRating"),
            drop: ["minRating"],
          },
        ]
      : []),
    ...(params.ward
      ? [{ key: "ward", label: t("noResults.removeWard"), drop: ["ward"] }]
      : []),
    ...(params.city
      ? [
          {
            key: "city",
            label: t("noResults.removeCity"),
            drop: ["city", "ward"],
          },
        ]
      : []),
    ...(roles && roles.length > 0
      ? [{ key: "roles", label: t("noResults.removeRoles"), drop: ["roles"] }]
      : []),
  ];

  const activeFilterCount = [
    roles?.length,
    params.city,
    params.ward,
    params.minPrice,
    params.maxPrice,
    params.minRating,
  ].filter(Boolean).length;

  const heading =
    roles && roles.length === 1 && result.province
      ? t("headingWithRoleCity", {
          role: roleT(roles[0]),
          city: result.province.name,
        })
      : t("headingDefault");

  return (
    <div className="mx-auto max-w-[1240px] px-4 pt-8 pb-[72px] sm:px-8">
      <BrowseFilterProvider>
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[268px_1fr]">
          <div className="hidden lg:block">
            <FilterSidebar
              roleCounts={roleCounts}
              categoryCounts={categoryCounts}
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
                    categoryCounts={categoryCounts}
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
                  <p className="text-body-lg font-semibold! text-text-primary">
                    {t("noResults.heading")}
                  </p>
                  <p className="text-body-md text-text-secondary">
                    {t("noResults.body")}
                  </p>
                  {removableFilters.length > 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-body-sm text-text-tertiary">
                        {t("noResults.tryRemoving")}
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {removableFilters.map((filter) => (
                          <Tag
                            key={filter.key}
                            render={
                              <Link href={queryWithout(params, filter.drop)} />
                            }
                          >
                            {filter.label}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/browse" />}
                  >
                    {t("clearFilters")}
                  </Button>
                  {result.province ? (
                    roles && roles.length === 1 ? (
                      <WaitlistForm
                        provinceId={result.province.id}
                        role={roles[0]}
                      />
                    ) : (
                      <p className="text-body-sm text-text-tertiary">
                        {t("waitlist.roleRequired")}
                      </p>
                    )
                  ) : null}
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
                          roles: profile.roles.map((role) => roleT(role)),
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
                          avatar: profile.user.avatar ?? undefined,
                          media: profile.media,
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

              {result.nationwide.length > 0 ? (
                <div className="mt-10 flex flex-col gap-4 border-t border-border-subtle pt-8">
                  <h2 className="text-heading-md text-text-primary">
                    {t("nationwideSection.heading")}
                  </h2>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {result.nationwide.map((profile) => (
                      <ArtistCard
                        key={profile.userId}
                        artist={{
                          id: profile.userId,
                          name:
                            profile.displayName ??
                            profile.user.name ??
                            t("unnamed"),
                          username: profile.user.username ?? "",
                          roles: profile.roles.map((role) => roleT(role)),
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
                          avatar: profile.user.avatar ?? undefined,
                          media: profile.media,
                          nationwideLabel: t("nationwideBadge"),
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </ResultsPane>
          </div>
        </div>
      </BrowseFilterProvider>
    </div>
  );
}
