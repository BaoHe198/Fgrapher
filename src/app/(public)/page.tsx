import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ClosingCta } from "@/components/home/closing-cta";
import { FeaturedArtists } from "@/components/home/featured-artists";
import { MapTeaser } from "@/components/home/map-teaser";
import { MoreFromFgrapher } from "@/components/home/more-from-fgrapher";
import { RoleTiles } from "@/components/home/role-tiles";
import { StyleGrid } from "@/components/home/style-grid";
import { TrustSection } from "@/components/home/trust-section";
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

export default async function LandingPage() {
  const t = await getTranslations();
  const tLanding = await getTranslations("publicPages.landing");

  const [featuredProfiles, showcase] = await Promise.all([
    getFeaturedProfiles(4),
    getHomeShowcase(),
  ]);

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

  return (
    <>
      {/* HERO: just the search (owner, 10/10/2026 - the page explains
          itself, so the headline and intro line went). The h1 stays for
          screen readers and search engines. */}
      <section className="relative bg-green-900 text-gold-50">
        <h1 className="sr-only">{t("hero.title")}</h1>
        <div className="mx-auto max-w-[1440px] px-8 py-10 max-md:px-5 max-md:py-5">
          <HeroSearch marketplaceEnabled={features.marketplaceEnabled} />
        </div>
      </section>

      <RoleTiles
        tiles={showcase.roles}
        marketplaceEnabled={features.marketplaceEnabled}
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

      <StyleGrid tiles={showcase.styles} />

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
