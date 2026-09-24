import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";
import { MapIcon, SearchX } from "lucide-react";
import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ArtistCard } from "@/components/cards/artist-card";
import { FilterSidebar } from "@/components/browse/filter-sidebar";
import {
  FilterParamsProvider,
  FilterResultsPane,
} from "@/components/filters/filter-params-provider";
import { MobileFilterSheet } from "@/components/browse/mobile-filter-sheet";
import { SearchInput } from "@/components/browse/search-input";
import { WaitlistForm } from "@/components/browse/waitlist-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { features } from "@/lib/features";
import { cn, formatCurrency } from "@/lib/utils";
import type { ServiceKind } from "@prisma/client";

import { serviceKindsForRole } from "@/lib/constants/service-matrix";
import { searchProfiles, type SortOption } from "@/services/search";
import { FMAP_PROVIDER_ROLES } from "@/lib/validations/fmap";

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

// Same idea as queryWithout, but for the quick-filter tags above the
// results — those set one param without discarding every other active
// filter (role/city/ward/category/budget/rating) the way a bare
// `href="?sort=rating"` would.
function queryWith(
  params: Record<string, string | undefined>,
  patch: Record<string, string>,
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) next.set(key, value);
  return `/browse?${next.toString()}`;
}

export async function generateMetadata() {
  const t = await getTranslations("publicPages.browse");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
    alternates: { canonical: "/browse" },
  };
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const t = await getTranslations("publicPages.browse");
  const roleT = await getTranslations("role");
  const serviceKindT = await getTranslations("serviceKind");
  const SORT_LABELS: Record<string, string> = {
    rating: t("sortLabels.rating"),
    price_asc: t("sortLabels.priceAsc"),
    price_desc: t("sortLabels.priceDesc"),
    newest: t("sortLabels.newest"),
    reviews: t("sortLabels.reviews"),
  };

  const params = await searchParams;

  const roles = params.roles?.split(",").filter(Boolean) as Role[] | undefined;
  const serviceKinds = params.services?.split(",").filter(Boolean) as
    ServiceKind[] | undefined;
  const categories = params.categories?.split(",").filter(Boolean) as
    ProfileCategory[] | undefined;

  // Carry a single role/category over to the map view so switching views
  // keeps the customer's context.
  const fmapParams = new URLSearchParams();
  const fmapRole = roles?.length === 1 ? roles[0] : undefined;
  if (
    fmapRole &&
    (FMAP_PROVIDER_ROLES as readonly string[]).includes(fmapRole)
  ) {
    fmapParams.set("role", fmapRole);
  }
  if (categories?.length === 1) fmapParams.set("category", categories[0]);
  const fmapHref = fmapParams.size > 0 ? `/fmap?${fmapParams}` : "/fmap";

  const sort = (params.sort as SortOption) ?? "rating";
  const page = params.page ? Number(params.page) : 1;

  const experienceLevel = params.experienceLevel?.split(",").filter(Boolean) as
    ExperienceLevel[] | undefined;

  const result = await searchProfiles({
    q: params.q,
    roles,
    serviceKinds,
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
  // Where the no-portfolio group begins on this page (see the divider in
  // the grid below). -1 when every card has photos, or none do.
  const firstNoPortfolioIndex = result.data.findIndex(
    (profile) => profile.media.length === 0,
  );

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

  // QA: selecting Photographer + Portrait (a role AND a category) still
  // showed "Bộ lọc (1)" — this array drove that badge but never included
  // `categories` at all (nor experienceLevel/height/travelWilling, the
  // Model-specific filters), so only role/city/ward/budget/rating ever
  // counted. Each entry counts as at most 1 regardless of how many values
  // are selected within it (roles?.length was already doing this for
  // multi-select roles) — the badge means "N filter types active", not a
  // literal sum of every checked box.
  const activeFilterCount = [
    roles?.length,
    categories?.length,
    params.city,
    params.ward,
    params.minPrice,
    params.maxPrice,
    params.minRating,
    experienceLevel?.length,
    params.heightMin,
    params.heightMax,
    params.travelWilling,
  ].filter(Boolean).length;

  const heading =
    roles && roles.length === 1 && result.province
      ? t("headingWithRoleCity", {
          role: roleT(roles[0]),
          city: result.province.name,
        })
      : t("headingDefault");

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-8 pb-[72px] sm:px-8">
      <FilterParamsProvider>
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
              {/* On a phone the search box gets a row of its own. Squeezed
                  between the map and filter buttons it was ~150px wide and
                  showed "Tìm nghệ sĩ, stu…" — the page's main control, too
                  narrow to say what it does. The map button then has room
                  for its label on the row below. */}
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Link
                  href={fmapHref}
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "md" }),
                    "shrink-0",
                  )}
                >
                  <MapIcon className="size-4" />
                  {t("viewOnMap")}
                </Link>
                <SearchInput
                  // Wide enough for the whole Vietnamese placeholder ("Tìm nghệ
                  // sĩ, studio hoặc thiết bị"); at w-64 it was cut off after
                  // "hoặc", hiding what the box can actually search for.
                  className="order-first w-full sm:order-none sm:w-80 lg:w-96"
                  marketplaceEnabled={features.marketplaceEnabled}
                />
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

            {/* Quick sort. This row used to hold a single tag — the default
                sort, permanently selected — so it could never do anything
                when clicked. Three real choices make it the fastest way to
                re-order results, and on a phone the only one that doesn't
                sit behind the filter sheet. The full list stays in the
                sidebar. */}
            <div className="mb-5 flex flex-wrap gap-2">
              {(["rating", "price_asc", "newest"] as const).map((option) => (
                <Tag
                  key={option}
                  selected={sort === option}
                  render={<Link href={queryWith(params, { sort: option })} />}
                >
                  {SORT_LABELS[option]}
                </Tag>
              ))}
            </div>

            <FilterResultsPane label={t("updatingResults")}>
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
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
                    {result.data.map((profile, index) => (
                      <Fragment key={profile.userId}>
                        {/* services/search.ts always ranks profiles with no
                            portfolio after those with one, whatever the sort.
                            That is deliberate, but invisible: sorted by price,
                            a 1.500.000₫ card landing after a 5.000.000₫ one
                            just looked like a broken sort. Naming the group
                            where it starts makes the order explain itself. */}
                        {index > 0 && index === firstNoPortfolioIndex ? (
                          <div className="col-span-full mt-3 flex flex-col gap-1 border-t border-border-subtle pt-5">
                            <p className="text-body-md font-semibold! text-text-primary">
                              {t("noPortfolioGroup.heading")}
                            </p>
                            <p className="text-body-sm text-text-secondary">
                              {t("noPortfolioGroup.body")}
                            </p>
                          </div>
                        ) : null}
                        <ArtistCard
                          // The first row is above the fold on every viewport
                          // width this grid supports, and one of those images
                          // is the page's LCP.
                          priority={index < 4}
                          artist={{
                            id: profile.userId,
                            name:
                              profile.displayName ??
                              profile.user.name ??
                              t("unnamed"),
                            username: profile.user.username ?? "",
                            // Role first, then anything extra they can be
                            // hired for — a studio that also shoots reads
                            // "Studio · Chụp ảnh" rather than just "Studio".
                            roles: [
                              ...profile.roles.map((role) => roleT(role)),
                              ...profile.serviceKinds
                                .filter(
                                  (kind) =>
                                    !profile.roles.some(
                                      (role) =>
                                        serviceKindsForRole(role)[0] === kind,
                                    ),
                                )
                                .map((kind) => serviceKindT(kind)),
                            ],
                            city: profile.location,
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
                      </Fragment>
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
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
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
                          // Role first, then anything extra they can be
                          // hired for — a studio that also shoots reads
                          // "Studio · Chụp ảnh" rather than just "Studio".
                          roles: [
                            ...profile.roles.map((role) => roleT(role)),
                            ...profile.serviceKinds
                              .filter(
                                (kind) =>
                                  !profile.roles.some(
                                    (role) =>
                                      serviceKindsForRole(role)[0] === kind,
                                  ),
                              )
                              .map((kind) => serviceKindT(kind)),
                          ],
                          city: profile.location,
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
            </FilterResultsPane>
          </div>
        </div>
      </FilterParamsProvider>
    </div>
  );
}
