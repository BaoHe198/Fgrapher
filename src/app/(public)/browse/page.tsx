import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";
import { MapIcon, SearchX, XIcon } from "lucide-react";
import { Fragment } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { AlbumCard } from "@/components/cards/album-card";
import {
  BrowseArtistCard,
  type BrowseArtist,
} from "@/components/browse/browse-artist-card";
import {
  BrowsePhotoGrid,
  type BrowsePhoto,
} from "@/components/browse/browse-photo-grid";
import { BrowseSearchBar } from "@/components/browse/browse-search-bar";
import { RoleRail } from "@/components/browse/role-rail";
import {
  FilterParamsProvider,
  FilterResultsPane,
} from "@/components/filters/filter-params-provider";
import { SearchInput } from "@/components/browse/search-input";
import { SortSelect } from "@/components/browse/sort-select";
import { WaitlistForm } from "@/components/browse/waitlist-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tag } from "@/components/ui/tag";
import { features } from "@/lib/features";
import { formatDate } from "@/lib/format";
import { DISCOVERABLE_ROLES, PROVIDER_ROLES } from "@/lib/constants";
import { shortPlace } from "@/lib/location";
import { cn, formatBudgetRange, formatCurrency } from "@/lib/utils";
import type { ServiceKind } from "@prisma/client";

import { normalizeSort, sanitizeShootWindow } from "@/lib/search/params";
import { listProvinces, listWards } from "@/services/geography";
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
  const locale = await getLocale();
  const provinceOptions = await listProvinces();

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
    page: params.tab === "albums" ? page : 1,
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
  const shootWindow = sanitizeShootWindow(params.date, params.from, params.to);
  const shootDateLabel = shootWindow.date
    ? formatDate(`${shootWindow.date}T00:00:00+07:00`)
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

  const tab =
    params.tab === "albums"
      ? "albums"
      : params.tab === "photos"
        ? "photos"
        : "artists";

  const toArtist = (
    profile: (typeof result.data)[number],
    extra: Partial<BrowseArtist> = {},
  ): BrowseArtist => ({
    id: profile.userId,
    name: profile.displayName ?? profile.user.name ?? t("unnamed"),
    username: profile.user.username ?? "",
    // The first role only, so the line never wraps.
    role: profile.roles[0] ? roleT(profile.roles[0]) : "",
    place: profile.location ? shortPlace(profile.location) : "",
    rating:
      profile.reviewCount > 0
        ? profile.avgRating.toFixed(1).replace(".", ",")
        : null,
    reviews: profile.reviewCount,
    priceFrom: profile.priceMin ? formatCurrency(profile.priceMin) : null,
    cover: profile.media.find((media) => media.type === "IMAGE")?.url ?? null,
    availability: shootDateLabel
      ? t("v3.availableOn", { date: shootDateLabel.slice(0, 5) })
      : undefined,
    ...extra,
  });
  const cardLabels = (artist: BrowseArtist) => ({
    from: t("v3.from"),
    askPrice: t("v3.askPrice"),
    isNew: t("v3.isNew"),
    noPhoto: t("v3.noPhoto"),
    aria: [
      artist.name,
      artist.role,
      artist.place,
      artist.priceFrom
        ? t("v3.ariaPrice", { price: artist.priceFrom })
        : t("v3.askPrice"),
      artist.rating
        ? t("v3.ariaRating", { rating: artist.rating, count: artist.reviews })
        : t("v3.isNew"),
      artist.availability,
    ]
      .filter(Boolean)
      .join(", "),
  });

  const photos: BrowsePhoto[] = result.data.flatMap((profile) =>
    profile.media
      .filter((media) => media.type === "IMAGE")
      .map((media) => ({
        id: media.id,
        url: media.url,
        width: media.width,
        height: media.height,
        artistName: profile.displayName ?? profile.user.name ?? t("unnamed"),
        username: profile.user.username ?? "",
        bookingHref: profile.roles.some((role) => PROVIDER_ROLES.includes(role))
          ? `/booking/${profile.userId}`
          : null,
      })),
  );

  const tabHref = (next: "artists" | "photos" | "albums") =>
    next === "artists"
      ? queryWithout(params, ["tab", "page"])
      : queryWith(queryWithoutParams(params, ["page"]), { tab: next });
  const pageHref = (n: number) => queryWith(params, { page: String(n) });

  const totalPages =
    tab === "albums"
      ? albumResult.totalPages
      : tab === "photos"
        ? 1
        : result.totalPages;

  // The title is the search in words: "Nhiếp ảnh gia tại Thành phố Hồ Chí
  // Minh"; on a phone it shrinks to the count, "8 nghệ sĩ tại TP. Hồ Chí
  // Minh", so the first card starts high on the screen.
  const subjectRole =
    roles && roles.length === 1 ? roleT(roles[0]) : t("v2.subjectDefault");
  const subjectStyle =
    categories && categories.length === 1
      ? categoryT(categories[0]).toLocaleLowerCase(locale)
      : null;
  const subject = subjectStyle
    ? t("v2.subjectWithStyle", { role: subjectRole, style: subjectStyle })
    : subjectRole;
  const title = place ? t("v2.titleAt", { subject, place }) : subject;
  const mobileTitle = t("v3.mobileTitle", {
    count: tab === "albums" ? albumResult.total : result.total,
    unit: tab === "albums" ? t("v3.unitAlbums") : t("v3.unitArtists"),
    place: place ? shortPlace(place) : t("v3.everywhere"),
  });

  // Only the filters not already on screen: role and area have the rail
  // and the search row, so they don't count toward the Bộ lọc badge.
  const advancedCount = [
    categories?.length,
    serviceKinds?.length,
    params.minPrice || params.maxPrice,
    params.minRating,
    experienceLevel?.length,
    params.heightMin || params.heightMax,
    params.travelWilling,
  ].filter(Boolean).length;

  const countLine =
    tab === "albums"
      ? t("v2.countAlbums", { count: albumResult.total })
      : tab === "photos"
        ? t("v2.countPhotos", {
            count: photos.length,
            artists: result.data.length,
          })
        : t("v2.countArtists", { count: result.total });

  return (
    <FilterParamsProvider>
      {/* The search block stays in reach while the results scroll. */}
      <div className="sticky top-[72px] z-10 border-b border-border-subtle bg-bg-page">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-8 pt-3 pb-3 max-md:px-4">
          <BrowseSearchBar
            provinces={provinceOptions.map((p) => ({
              code: p.code,
              name: p.name,
            }))}
            roleCounts={roleCounts}
            categoryCounts={categoryCounts}
            advancedCount={advancedCount}
            resultCount={tab === "albums" ? albumResult.total : result.total}
            marketplaceEnabled={features.marketplaceEnabled}
          />
          <RoleRail roles={DISCOVERABLE_ROLES} />
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-8 pt-6 pb-[72px] max-md:px-4 max-md:pt-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-display-sm text-balance text-text-primary max-md:hidden lg:text-display-md">
            {title}
          </h1>
          <h1 className="text-heading-md text-text-primary md:hidden">
            {mobileTitle}
          </h1>
          <p
            role="status"
            className="text-body-sm text-text-secondary max-md:hidden"
          >
            {countLine}
          </p>
        </div>

        {activeChips.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <Link
                key={chip.key}
                href={chipHref(chip)}
                aria-label={t("removeFilter", { filter: chip.label })}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-surface py-1.5 pr-2.5 pl-3.5 text-body-sm text-text-primary transition-colors hover:border-border-strong"
              >
                {chip.label}
                <XIcon aria-hidden className="size-3.5 text-text-tertiary" />
              </Link>
            ))}
            <Link
              href={
                params.q
                  ? `/browse?q=${encodeURIComponent(params.q)}`
                  : "/browse"
              }
              className="focus-ring rounded-[4px] px-1 text-body-sm font-semibold! text-text-link"
            >
              {t("clearAll")}
            </Link>
          </div>
        ) : null}

        {/* One row on a phone: the views and a map button. Sort and the
            keyword search live in the filter sheet and ⌘K there. */}
        <div className="mt-4 flex items-center justify-between gap-3 md:mt-6">
          <nav
            aria-label={t("tabsLabel")}
            className="flex min-w-0 rounded-full border border-border-default bg-bg-surface p-1"
          >
            {(["artists", "photos", "albums"] as const).map((key) => (
              <Link
                key={key}
                href={tabHref(key)}
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "focus-ring flex min-h-11 items-center rounded-full px-3.5 text-body-sm whitespace-nowrap transition-colors duration-[var(--fg-dur-150)] md:px-4",
                  tab === key
                    ? "bg-brand-primary font-semibold! text-text-on-brand"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {t(`v2.tabs.${key}`)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <SearchInput
              className="w-64 max-lg:hidden"
              marketplaceEnabled={features.marketplaceEnabled}
            />
            {tab === "artists" ? (
              <div className="w-52 max-md:hidden">
                <SortSelect />
              </div>
            ) : null}
            <Link
              href={fmapHref}
              aria-label={t("v2.showMap")}
              className={cn(
                buttonVariants({ variant: "outline", size: "md" }),
                "min-h-11 shrink-0 max-md:size-11 max-md:px-0",
              )}
            >
              <MapIcon aria-hidden className="size-4" />
              <span className="max-md:hidden">{t("v2.showMap")}</span>
            </Link>
          </div>
        </div>

        <div className="mt-5 md:mt-8">
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
                      countLabel={t("photoCount", { count: album.photoCount })}
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
            ) : tab === "photos" ? (
              photos.length === 0 ? (
                <EmptyState
                  icon={<SearchX />}
                  title={t("v2.noPhotos")}
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
                <BrowsePhotoGrid photos={photos} />
              )
            ) : (
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 min-[430px]:grid-cols-2 min-[430px]:gap-y-8 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-x-5">
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
                    {(() => {
                      const artist = toArtist(profile);
                      return (
                        <BrowseArtistCard
                          // The first two images are eager (LCP), the rest
                          // lazy.
                          eager={index < 2}
                          artist={artist}
                          labels={cardLabels(artist)}
                        />
                      );
                    })()}
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
              <div className="mt-10 flex flex-col gap-5 border-t border-border-subtle pt-8">
                <h2 className="text-heading-md text-text-primary">
                  {t("nationwideSection.heading")}
                </h2>
                <div className="grid grid-cols-1 gap-x-4 gap-y-5 min-[430px]:grid-cols-2 min-[430px]:gap-y-8 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-x-5">
                  {result.nationwide.map((profile) => (
                    <BrowseArtistCard
                      key={profile.userId}
                      artist={toArtist(profile, {
                        badge: t("nationwideBadge"),
                      })}
                      labels={cardLabels(
                        toArtist(profile, { badge: t("nationwideBadge") }),
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </FilterResultsPane>
        </div>
      </div>
    </FilterParamsProvider>
  );
}
