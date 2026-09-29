import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";
import { MapIcon, SearchX, XIcon } from "lucide-react";
import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AlbumCard } from "@/components/cards/album-card";
import { ArtistCard } from "@/components/cards/artist-card";
import { FilterSidebar } from "@/components/browse/filter-sidebar";
import {
  FilterParamsProvider,
  FilterResultsPane,
} from "@/components/filters/filter-params-provider";
import { MobileFilterSheet } from "@/components/browse/mobile-filter-sheet";
import { SearchInput } from "@/components/browse/search-input";
import { SortSelect } from "@/components/browse/sort-select";
import { WaitlistForm } from "@/components/browse/waitlist-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "@/components/ui/tag";
import { features } from "@/lib/features";
import { formatDate } from "@/lib/format";
import { cn, formatBudgetRange, formatCurrency } from "@/lib/utils";
import type { ServiceKind } from "@prisma/client";

import { serviceKindsForRole } from "@/lib/constants/service-matrix";
import { normalizeSort, sanitizeShootWindow } from "@/lib/search/params";
import { listWards } from "@/services/geography";
import { searchAlbums, searchProfiles } from "@/services/search";
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

function queryWithoutParams(
  params: Record<string, string | undefined>,
  keysToDrop: string[],
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => !keysToDrop.includes(key)),
  );
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
  const categoryT = await getTranslations("profileCategory");

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

  const sort = normalizeSort(params.sort);
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
    date: params.date,
    from: params.from,
    to: params.to,
    sort,
    page: params.tab === "albums" ? 1 : page,
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

  const tab = params.tab === "albums" ? "albums" : "artists";
  const albumResult = await searchAlbums({
    q: params.q,
    roles,
    serviceKinds,
    city: params.city,
    wardId: params.ward,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    categories,
    minRating: params.minRating ? Number(params.minRating) : undefined,
    page: tab === "albums" ? page : 1,
  });

  const wardName =
    params.ward && params.city
      ? (await listWards(params.city)).find((w) => w.id === params.ward)?.name
      : undefined;
  const place = result.province
    ? wardName
      ? `${wardName}, ${result.province.name}`
      : result.province.name
    : undefined;
  const heading =
    roles && roles.length === 1
      ? place
        ? t("headingWithRoleCity", { role: roleT(roles[0]), city: place })
        : roleT(roles[0])
      : place
        ? t("headingPlace", { place })
        : t("headingDefault");

  const shootWindow = sanitizeShootWindow(params.date, params.from, params.to);
  const shootDateLabel = shootWindow.date
    ? formatDate(`${shootWindow.date}T00:00:00+07:00`)
    : undefined;
  const availabilityLabel = shootDateLabel
    ? t("availableOn", { date: shootDateLabel })
    : undefined;

  // The chips above the results: one per active filter, each removable on
  // its own, plus "Xóa tất cả" (which keeps the keyword - that belongs to
  // the search box, not the filters).
  const activeChips: { key: string; label: string; drop: string[] }[] = [
    ...(place
      ? [
          {
            key: "place",
            label: wardName ?? result.province!.name,
            drop: wardName ? ["ward"] : ["city", "ward"],
          },
        ]
      : []),
    ...(shootDateLabel
      ? [
          {
            key: "date",
            label: shootWindow.from
              ? `${shootDateLabel} · ${shootWindow.from}–${shootWindow.to}`
              : shootDateLabel,
            drop: ["date", "from", "to"],
          },
        ]
      : []),
    ...(roles ?? []).map((role) => ({
      key: `role-${role}`,
      label: roleT(role),
      drop: ["roles"],
    })),
    ...(serviceKinds ?? []).map((kind) => ({
      key: `service-${kind}`,
      label: serviceKindT(kind),
      drop: ["services"],
    })),
    ...(categories ?? []).map((category) => ({
      key: `category-${category}`,
      label: categoryT(category),
      drop: ["categories"],
    })),
    ...(params.minPrice || params.maxPrice
      ? [
          {
            key: "budget",
            label:
              formatBudgetRange(
                params.minPrice ? Number(params.minPrice) : null,
                params.maxPrice ? Number(params.maxPrice) : null,
              ) ?? "",
            drop: ["minPrice", "maxPrice"],
          },
        ]
      : []),
    ...(params.minRating
      ? [
          {
            key: "rating",
            label: t("ratingChip", {
              rating: Number(params.minRating).toFixed(1).replace(".", ","),
            }),
            drop: ["minRating"],
          },
        ]
      : []),
  ];
  // Removing one value of a multi-value filter drops only that value.
  const chipHref = (chip: (typeof activeChips)[number]) => {
    const [kind, value] = chip.key.split(/-(.+)/);
    const listKey =
      kind === "role"
        ? "roles"
        : kind === "service"
          ? "services"
          : kind === "category"
            ? "categories"
            : null;
    if (listKey && value) {
      const rest = (params[listKey] ?? "")
        .split(",")
        .filter((v) => v && v !== value);
      return rest.length > 0
        ? queryWith(queryWithoutParams(params, ["page"]), {
            [listKey]: rest.join(","),
          })
        : queryWithout(params, [listKey, "page"]);
    }
    return queryWithout(params, [...chip.drop, "page"]);
  };

  const toArtist = (
    profile: (typeof result.data)[number],
    extra: object = {},
  ) => ({
    id: profile.userId,
    name: profile.displayName ?? profile.user.name ?? t("unnamed"),
    username: profile.user.username ?? "",
    // Role first, then anything extra they can be hired for - a studio
    // that also shoots reads "Studio · Chụp ảnh" rather than just "Studio".
    roles: [
      ...profile.roles.map((role) => roleT(role)),
      ...profile.serviceKinds
        .filter(
          (kind) =>
            !profile.roles.some(
              (role) => serviceKindsForRole(role)[0] === kind,
            ),
        )
        .map((kind) => serviceKindT(kind)),
    ],
    city: profile.location,
    rating:
      profile.avgRating > 0 ? profile.avgRating.toFixed(1) : t("newBadge"),
    reviews: profile.reviewCount,
    price: profile.priceMin
      ? t("priceFrom", { price: formatCurrency(profile.priceMin) })
      : t("contactForPricing"),
    avatar: profile.user.avatar ?? undefined,
    media: profile.media,
    availabilityLabel,
    ...extra,
  });

  const tabHref = (next: "artists" | "albums") =>
    next === "albums"
      ? queryWith(queryWithoutParams(params, ["page"]), { tab: "albums" })
      : queryWithout(params, ["tab", "page"]);
  const pageHref = (n: number) => queryWith(params, { page: String(n) });

  const totalPages =
    tab === "albums" ? albumResult.totalPages : result.totalPages;

  return (
    <FilterParamsProvider>
      {/* Header band: what is being searched, and the keyword box. */}
      <div className="border-b border-border-subtle bg-bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-8 py-8 max-md:px-5 max-md:py-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-meta tracking-[0.12em] text-gold-700 uppercase dark:text-gold-400">
              {t("eyebrow")}
            </span>
            <h1 className="max-w-3xl text-display-md text-text-primary lg:text-display-lg">
              {heading}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <SearchInput
              className="order-first w-full lg:order-none lg:w-[420px]"
              marketplaceEnabled={features.marketplaceEnabled}
            />
            <Link
              href={fmapHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "md" }),
                "shrink-0",
              )}
            >
              <MapIcon className="size-4" />
              {t("viewOnMap")}
            </Link>
            <div className="lg:hidden">
              <MobileFilterSheet
                roleCounts={roleCounts}
                categoryCounts={categoryCounts}
                activeCount={activeFilterCount}
                resultCount={
                  tab === "albums" ? albumResult.total : result.total
                }
                marketplaceEnabled={features.marketplaceEnabled}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-8 pt-8 pb-[72px] max-md:px-5">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[252px_1fr]">
          <div className="hidden lg:block">
            <FilterSidebar
              roleCounts={roleCounts}
              categoryCounts={categoryCounts}
              marketplaceEnabled={features.marketplaceEnabled}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-end justify-between gap-4 border-b border-border-subtle">
              <nav aria-label={t("tabsLabel")} className="flex gap-6">
                {(
                  [
                    ["artists", t("tabArtists"), result.total],
                    ["albums", t("tabAlbums"), albumResult.total],
                  ] as const
                ).map(([key, label, count]) => (
                  <Link
                    key={key}
                    href={tabHref(key)}
                    aria-current={tab === key ? "page" : undefined}
                    className={cn(
                      "focus-ring relative -mb-px flex items-baseline gap-1.5 border-b-2 pb-3 text-body-md transition-colors duration-[var(--fg-dur-150)]",
                      tab === key
                        ? "border-brand-primary font-semibold! text-text-primary"
                        : "border-transparent text-text-secondary hover:text-text-primary",
                    )}
                  >
                    {label}
                    <span className="font-mono text-meta tabular-nums text-text-tertiary">
                      {count}
                    </span>
                  </Link>
                ))}
              </nav>
              {tab === "artists" ? (
                <div className="mb-2 hidden w-56 sm:block">
                  <SortSelect />
                </div>
              ) : null}
            </div>

            {activeChips.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <Link
                    key={chip.key}
                    href={chipHref(chip)}
                    aria-label={t("removeFilter", { filter: chip.label })}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-surface py-1 pr-2 pl-3 text-body-sm text-text-primary transition-colors hover:border-border-strong"
                  >
                    {chip.label}
                    <XIcon
                      aria-hidden
                      className="size-3.5 text-text-tertiary"
                    />
                  </Link>
                ))}
                <Link
                  href={
                    params.q
                      ? `/browse?q=${encodeURIComponent(params.q)}`
                      : "/browse"
                  }
                  className="focus-ring rounded-[4px] px-1 text-body-sm font-semibold! text-text-link underline underline-offset-4"
                >
                  {t("clearAll")}
                </Link>
              </div>
            ) : null}

            <div className="mt-6">
              <FilterResultsPane label={t("updatingResults")}>
                {tab === "albums" ? (
                  albumResult.data.length === 0 ? (
                    <EmptyState
                      icon={<SearchX />}
                      title={t("noAlbums.heading")}
                      description={t("noAlbums.body")}
                      primaryAction={
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={tabHref("artists")} />}
                        >
                          {t("noAlbums.seeArtists")}
                        </Button>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-x-5 gap-y-8 max-sm:gap-x-3 xl:grid-cols-3">
                      {albumResult.data.map((album, index) => (
                        <AlbumCard
                          key={album.id}
                          href={`/profile/${album.providerUsername}?album=${album.id}#portfolio`}
                          title={album.title}
                          description={album.description}
                          coverUrl={album.coverUrl}
                          countLabel={t("photoCount", {
                            count: album.photoCount,
                          })}
                          byline={[
                            album.providerName,
                            album.category ? categoryT(album.category) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          revealIndex={index}
                        />
                      ))}
                    </div>
                  )
                ) : result.data.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <SearchX className="size-12 text-text-tertiary" />
                    <p className="text-body-lg font-semibold! text-text-primary">
                      {shootDateLabel
                        ? t("noResults.headingOnDate", { date: shootDateLabel })
                        : t("noResults.heading")}
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
                                <Link
                                  href={queryWithout(params, filter.drop)}
                                />
                              }
                            >
                              {filter.label}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <Button
                      variant="outline"
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
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
                    {result.data.map((profile, index) => (
                      <Fragment key={profile.userId}>
                        {/* services/search.ts always ranks profiles with no
                          portfolio after those with one, whatever the sort.
                          Naming the group where it starts makes the order
                          explain itself. */}
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
                          // The first row is above the fold and holds the LCP.
                          priority={index < 4}
                          artist={toArtist(profile)}
                        />
                      </Fragment>
                    ))}
                  </div>
                )}

                {totalPages > 1 ? (
                  <div className="mt-10 flex flex-col items-center gap-3">
                    <p className="text-meta text-text-tertiary">
                      {t("pageOf", { page, total: totalPages })}
                    </p>
                    <div className="flex gap-2">
                      {page > 1 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={pageHref(page - 1)} />}
                        >
                          {t("previous")}
                        </Button>
                      ) : null}
                      {page < totalPages ? (
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={pageHref(page + 1)} />}
                        >
                          {t("loadMore")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {tab === "artists" && result.nationwide.length > 0 ? (
                  <div className="mt-10 flex flex-col gap-4 border-t border-border-subtle pt-8">
                    <h2 className="text-heading-md text-text-primary">
                      {t("nationwideSection.heading")}
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
                      {result.nationwide.map((profile) => (
                        <ArtistCard
                          key={profile.userId}
                          artist={toArtist(profile, {
                            nationwideLabel: t("nationwideBadge"),
                          })}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </FilterResultsPane>
            </div>
          </div>
        </div>
      </div>
    </FilterParamsProvider>
  );
}
