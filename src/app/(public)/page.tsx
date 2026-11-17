import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ArtistRow, type RowArtist } from "@/components/home/artist-row";
import { ClosingCta } from "@/components/home/closing-cta";
import { Darkroom } from "@/components/home/darkroom";
import { HomeFilter, HomeRows } from "@/components/home/home-filter";
import { HomeSearch } from "@/components/home/home-search";
import { MapTeaser } from "@/components/home/map-teaser";
import { MoreFromFgrapher } from "@/components/home/more-from-fgrapher";
import { StyleGrid } from "@/components/home/style-grid";
import { TrustSection } from "@/components/home/trust-section";
import { features } from "@/lib/features";
import { shortPlace } from "@/lib/location";
import { formatCurrency } from "@/lib/utils";
import { getHomeShowcase, HOME_ROLES } from "@/services/home";
import { listProvinces } from "@/services/geography";
import {
  getFeaturedProfiles,
  SEARCHABLE_ROLES,
  searchProfiles,
} from "@/services/search";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo.home");
  const title = t("title");
  const description = t("description");
  const url = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

// "Được yêu thích" is earned, never assigned: a 4.8 average over at least
// three reviews, all from completed bookings. Airbnb's Guest Favourite works
// the same way (a rating bar plus a minimum count), and anything looser
// would put the badge on a profile one happy friend had reviewed.
const FAVOURITE_MIN_RATING = 4.8;
const FAVOURITE_MIN_REVIEWS = 3;

// The home page, laid out like Airbnb's (owner, 17/11/2026): service tabs
// and one search pill at the top, then rows of photo cards a visitor can
// scroll sideways - one row per kind of service, best rated first. A tab
// filters this page in place: its service's best rated, then one row per
// province. The
// sections that are Fgrapher's own (styles, the darkroom, Bản đồ F, the
// trust band) follow the rows.
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const [t, roleT, rowT, { role: roleParam }] = await Promise.all([
    getTranslations(),
    getTranslations("role"),
    getTranslations("home.rows"),
    searchParams,
  ]);
  const rowRoles = HOME_ROLES.filter((role) => SEARCHABLE_ROLES.includes(role));
  // A service tab picked on this page (/?role=PHOTOGRAPHER): the rows below
  // switch to that service, Airbnb-style, instead of jumping to Tìm kiếm F.
  const activeRole = rowRoles.find((role) => role === roleParam) ?? null;

  const [provinces, showcase, featuredProfiles, ...roleResults] =
    await Promise.all([
      listProvinces(),
      getHomeShowcase(),
      getFeaturedProfiles(4),
      ...(activeRole
        ? [searchProfiles({ roles: [activeRole], sort: "rating", limit: 50 })]
        : rowRoles.map((role) =>
            searchProfiles({ roles: [role], sort: "rating", limit: 12 }),
          )),
    ]);

  type Found = NonNullable<(typeof roleResults)[number]>["data"][number];
  const toArtist = (profile: Found, role: (typeof rowRoles)[number]) => {
    const place = profile.location ? shortPlace(profile.location) : "";
    return {
      id: profile.userId,
      username: profile.user.username ?? "",
      name:
        profile.displayName ??
        profile.user.name ??
        t("publicPages.landing.unnamed"),
      subtitle: place
        ? t("publicPages.profile.roleIn", { role: roleT(role), place })
        : roleT(role),
      cover: profile.media.find((media) => media.type === "IMAGE")?.url ?? null,
      priceFrom: profile.priceMin ? formatCurrency(profile.priceMin) : null,
      rating:
        profile.reviewCount > 0
          ? profile.avgRating.toFixed(1).replace(".", ",")
          : null,
      reviews: profile.reviewCount,
      favourite:
        profile.reviewCount >= FAVOURITE_MIN_REVIEWS &&
        profile.avgRating >= FAVOURITE_MIN_RATING,
    } satisfies RowArtist;
  };

  let rows: {
    key: string;
    title: string;
    href: string;
    artists: RowArtist[];
  }[];
  if (activeRole) {
    // One tab: the best rated first, then one row per province that has
    // someone, busiest first - Airbnb's "Services in Hanoi", "Services in
    // Ho Chi Minh". The province is the last part of the place line, which
    // is the registry's own name, so it maps back to its code for the link.
    const found = (roleResults[0]?.data ?? []).filter((p) => p.user.username);
    const byProvince = new Map<string, Found[]>();
    for (const profile of found) {
      const province = profile.location?.split(",").pop()?.trim();
      if (!province) continue;
      byProvince.set(province, [...(byProvince.get(province) ?? []), profile]);
    }
    const provinceRows =
      byProvince.size > 1
        ? [...byProvince.entries()]
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 6)
            .map(([name, profiles]) => {
              const code = provinces.find((p) => p.name === name)?.code;
              return {
                key: `${activeRole}-${name}`,
                title: rowT("inProvince", {
                  role: roleT(activeRole),
                  place: shortPlace(name),
                }),
                href: `/browse?roles=${activeRole}${code ? `&city=${code}` : ""}`,
                artists: profiles.map((p) => toArtist(p, activeRole)),
              };
            })
        : [];
    rows = [
      {
        key: activeRole,
        title: rowT(`titles.${activeRole}`),
        href: `/browse?roles=${activeRole}`,
        artists: found.slice(0, 12).map((p) => toArtist(p, activeRole)),
      },
      ...provinceRows,
    ];
  } else {
    rows = rowRoles.map((role, index) => ({
      key: role,
      title: rowT(`titles.${role}`),
      href: `/browse?roles=${role}`,
      artists: (roleResults[index]?.data ?? [])
        .filter((p) => p.user.username)
        .map((p) => toArtist(p, role)),
    }));
  }
  rows = rows.filter((row) => row.artists.length > 0);

  return (
    <>
      <HomeFilter>
        <section className="border-b border-border-subtle bg-bg-page pt-6 pb-8 max-md:pt-4 max-md:pb-6">
          <div className="mx-auto max-w-[1440px] px-8 max-md:px-5">
            {/* Airbnb opens on the search, not a headline; the page still
              needs its one h1 for screen readers and search engines. */}
            <h1 className="sr-only">{t("hero.title")}</h1>
            <HomeSearch
              provinces={provinces.map((p) => ({ code: p.code, name: p.name }))}
              roles={rowRoles}
              activeRole={activeRole}
            />
          </div>
        </section>

        <HomeRows>
          {rows.map((row) => (
            <ArtistRow
              key={row.key}
              title={row.title}
              href={row.href}
              artists={row.artists}
            />
          ))}
        </HomeRows>
      </HomeFilter>

      <StyleGrid tiles={showcase.styles} />

      <Darkroom />

      <MapTeaser
        artists={featuredProfiles.map((profile) => ({
          id: profile.userId,
          name:
            profile.displayName ??
            profile.user.name ??
            t("publicPages.landing.unnamed"),
          photoUrl: profile.media.find((m) => m.type === "IMAGE")?.url ?? null,
          priceMin: profile.priceMin,
          location: profile.location,
          roleLabel: roleT(profile.roles[0]),
        }))}
      />

      <TrustSection review={showcase.review} />

      <MoreFromFgrapher
        marketplaceEnabled={features.marketplaceEnabled}
        socialFeedEnabled={features.socialFeedEnabled}
      />

      <ClosingCta />
    </>
  );
}
