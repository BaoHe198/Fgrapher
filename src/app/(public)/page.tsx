import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ArtistCard } from "@/components/cards/artist-card";
import { HeroContactSheet } from "@/components/sections/hero-contact-sheet";
import { HeroSearch } from "@/components/sections/hero-search";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
// The "features" and "how it works" sections that sat between the featured
// artists and the CTA were removed (project owner, 26/09/2026): their copy
// was too thin to describe the product. Do not bring them back as-is.
import { features } from "@/lib/features";
import { formatCurrency } from "@/lib/utils";
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

  const featuredProfiles = await getFeaturedProfiles(4);
  const heroPhotos = HERO_PHOTOS.map((photo) => ({
    url: photo.url,
    alt: t(photo.altKey),
  }));

  return (
    <>
      {/* SECTION 1 — HERO */}
      <section className="relative bg-green-900 text-gold-50">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-8 py-10 max-md:px-5">
          {/* Below lg both wrappers collapse to `contents`, so the heading
              and the search box below become direct children of this
              section's flex column. The intro paragraph that used to sit
              here was removed (project owner, 21/09/2026): it pushed the
              search box — the only thing on this page anyone came to use —
              down the screen. Desktop keeps the two-column layout. */}
          <div className="grid grid-cols-[1.4fr_1fr] items-center gap-10 max-lg:contents">
            <div className="flex flex-col gap-[22px] max-lg:contents">
              <h1 className="m-0 text-display-lg tracking-[-0.02em] lg:text-display-xl">
                {t("hero.title")}
              </h1>
            </div>

            <HeroContactSheet photos={heroPhotos} />
          </div>

          {/* Full hero width rather than confined to the left text column —
              at 5 filters + a search button, the dropdown box needs more
              room than the 2-column split above leaves it to fit them on
              one row. */}
          <div className="max-lg:order-1">
            <HeroSearch marketplaceEnabled={features.marketplaceEnabled} />
          </div>
        </div>
      </section>

      {/* SECTION 2 — FEATURED ARTISTS */}
      {featuredProfiles.length > 0 ? (
        <section className="mx-auto max-w-[1440px] px-8 py-[72px] max-md:px-5">
          <SectionHead
            title={t("home.featured")}
            actionLabel={t("home.seeAll")}
            actionHref="/browse"
          />
          <div className="grid grid-cols-4 gap-5 max-lg:grid-cols-2 max-md:grid-cols-2 max-md:gap-3">
            {featuredProfiles.map((profile) => (
              <ArtistCard
                key={profile.userId}
                artist={{
                  id: profile.userId,
                  name:
                    profile.displayName ??
                    profile.user.name ??
                    tLanding("unnamed"),
                  username: profile.user.username ?? "",
                  roles: profile.roles.map((role) => t(`role.${role}`)),
                  city: profile.location,
                  rating:
                    profile.avgRating > 0
                      ? profile.avgRating.toFixed(1)
                      : tLanding("newBadge"),
                  reviews: profile.reviewCount,
                  price: profile.priceMin
                    ? tLanding("priceFrom", {
                        price: formatCurrency(profile.priceMin),
                      })
                    : tLanding("contactForPricing"),
                  avatar: profile.user.avatar ?? undefined,
                  media: profile.media,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* SECTION 3 — CTA */}
      <section className="bg-green-900 text-gold-50">
        <div className="mx-auto max-w-[1440px] px-8 py-20 text-center max-md:px-5">
          <h2 className="text-display-lg">{t("home.ctaTitle")}</h2>
          <p className="mx-auto max-w-[520px] text-body-lg text-green-200">
            {t("home.ctaSub")}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="accent"
              nativeButton={false}
              render={<Link href="/login?mode=register" />}
            >
              {t("home.ctaBtn")}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
