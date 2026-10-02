import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ClosingCta } from "@/components/home/closing-cta";
import { FeaturedArtists } from "@/components/home/featured-artists";
import { MapTeaser } from "@/components/home/map-teaser";
import { MoreFromFgrapher } from "@/components/home/more-from-fgrapher";
import { RoleTiles } from "@/components/home/role-tiles";
import { StyleGrid } from "@/components/home/style-grid";
import { TrustSection } from "@/components/home/trust-section";
import { HeroContactSheet } from "@/components/sections/hero-contact-sheet";
import { HeroSearch } from "@/components/sections/hero-search";
import { RiseOnView } from "@/components/ui/rise-on-view";
import { SectionHead } from "@/components/ui/section-head";
// The "features" and "how it works" sections that sat between the featured
// artists and the CTA were removed (project owner, 26/09/2026): their copy
// was too thin to describe the product. Do not bring them back as-is. The
// 09/2026 redesign's trust block (TrustSection) replaces them with concrete
// proof - a real review, the verified badge - rather than generic copy.
import { features } from "@/lib/features";
import { formatCurrency } from "@/lib/utils";
import { getHomeShowcase, HOME_STYLES } from "@/services/home";
import { getFeaturedProfiles } from "@/services/search";

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

// Hero artwork is deliberately isolated from provider/customer uploads.
// Replace these files in public/images/hero-professions/ when the brand has
// new artwork; the landing page must never source this area from portfolio
// media or any other user-owned content.
const HERO_PHOTOS = [
  {
    url: "/images/hero-professions/photographer.jpg",
    altKey: "hero.imageAlt.photographer",
  },
  {
    url: "/images/hero-professions/makeup-artist.jpg",
    altKey: "hero.imageAlt.makeupArtist",
  },
  {
    url: "/images/hero-professions/videographer.jpg",
    altKey: "hero.imageAlt.videographer",
  },
  {
    url: "/images/hero-professions/studio.jpg",
    altKey: "hero.imageAlt.studio",
  },
] as const;

export default async function LandingPage() {
  const t = await getTranslations();
  const tLanding = await getTranslations("publicPages.landing");

  const [featuredProfiles, showcase] = await Promise.all([
    getFeaturedProfiles(4),
    getHomeShowcase(),
  ]);
  const heroPhotos = HERO_PHOTOS.map((photo) => ({
    url: photo.url,
    alt: t(photo.altKey),
  }));

  const artists = featuredProfiles.map((profile) => ({
    id: profile.userId,
    name: profile.displayName ?? profile.user.name ?? tLanding("unnamed"),
    username: profile.user.username ?? "",
    roles: profile.roles.map((role) => t(`role.${role}`)),
    city: profile.location,
    rating:
      profile.avgRating > 0
        ? profile.avgRating.toFixed(1)
        : tLanding("newBadge"),
    reviews: profile.reviewCount,
    price: profile.priceMin
      ? tLanding("priceFrom", { price: formatCurrency(profile.priceMin) })
      : tLanding("contactForPricing"),
    avatar: profile.user.avatar ?? undefined,
    media: profile.media,
    nationwideLabel: profile.servesNationwide
      ? t("publicPages.browse.nationwideBadge")
      : undefined,
    categories: profile.categories,
  }));

  // Contact-sheet frame numbers run down the page: the hero is 01, the
  // role tiles follow, then the style collages (redesign 09/2026, §06).
  const roleFrame = 2;
  const styleFrame = roleFrame + showcase.roles.length;

  return (
    <>
      {/* HERO - frame 01 */}
      <section className="relative bg-green-900 text-gold-50">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-8 py-12 max-md:gap-5 max-md:px-5 max-md:py-8">
          <div className="grid grid-cols-[1.4fr_1fr] items-center gap-10 max-lg:contents">
            <div className="flex flex-col gap-5 max-lg:contents">
              <span className="flex items-center gap-3 font-mono text-meta tracking-[0.12em] text-gold-400 uppercase">
                {t("home.frameLabel", { n: "01" })}
                <span
                  aria-hidden
                  className="h-px flex-1 bg-gold-400/40 lg:max-w-16"
                />
                {t("home.scope")}
              </span>
              <h1 className="m-0 text-display-lg tracking-[-0.02em] lg:text-display-xl">
                {t("hero.title")}
              </h1>
              {/* One line, under the title: the owner cut a longer intro
                  (21/09/2026) because it pushed the search box down on a
                  phone. The redesign brings back a single sentence; phones
                  get the shorter one. */}
              <p className="max-w-xl text-body-md text-green-200 max-md:text-body-sm">
                <span className="max-md:hidden">
                  {t("home.heroSub", { count: showcase.provinceCount })}
                </span>
                <span className="md:hidden">{t("home.heroSubShort")}</span>
              </p>
            </div>

            <HeroContactSheet photos={heroPhotos} />
          </div>

          {/* Full hero width: five filters and a button need more room
              than the text column leaves. */}
          <div className="max-lg:order-1">
            <HeroSearch marketplaceEnabled={features.marketplaceEnabled} />
          </div>
        </div>
      </section>

      <RoleTiles
        tiles={showcase.roles}
        marketplaceEnabled={features.marketplaceEnabled}
        firstFrame={roleFrame}
      />

      {artists.length > 0 ? (
        <section className="mx-auto max-w-[1440px] px-8 pt-16 max-md:px-5 max-md:pt-10">
          <RiseOnView>
            <SectionHead
              title={t("home.featured")}
              actionLabel={t("home.seeAll")}
              actionHref="/browse"
            />
          </RiseOnView>
          <FeaturedArtists artists={artists} styles={HOME_STYLES} />
        </section>
      ) : null}

      <StyleGrid tiles={showcase.styles} firstFrame={styleFrame} />

      <MapTeaser
        artists={featuredProfiles.map((profile) => ({
          id: profile.userId,
          name: profile.displayName ?? profile.user.name ?? tLanding("unnamed"),
          photoUrl: profile.media.find((m) => m.type === "IMAGE")?.url ?? null,
          priceMin: profile.priceMin,
          location: profile.location,
          roleLabel: t(`role.${profile.roles[0]}`),
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
