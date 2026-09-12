import type { Metadata } from "next";
import { CalendarCheck, Search, ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ArtistCard } from "@/components/cards/artist-card";
import { HeroContactSheet } from "@/components/sections/hero-contact-sheet";
import { HeroSearch } from "@/components/sections/hero-search";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
import { features } from "@/lib/features";
import { formatCurrency } from "@/lib/utils";
import { getFeaturedProfiles, getHeroPhotos } from "@/services/search";

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

// phase-1 Step 6 invented this 3-step section — there is no corresponding
// content in the design's real i18n strings (window.FG_STRINGS). Now
// wired to publicPages.landing per CLAUDE.md rule #10 (full Vietnamese UI).
// Used only until real approved portfolio photos exist — see heroPhotos
// below. Kept as the original four so the hero never renders empty on a
// brand-new install.
const FALLBACK_HERO_PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1497316730643-415fac54a2af?q=80&w=800&auto=format&fit=crop",
    altKey: "hero.imageAlt.photographer",
  },
  {
    url: "https://images.unsplash.com/photo-1622336889416-8d790ad807d7?q=80&w=800&auto=format&fit=crop",
    altKey: "hero.imageAlt.makeupArtist",
  },
  {
    url: "https://images.unsplash.com/photo-1497015289639-54688650d173?q=80&w=800&auto=format&fit=crop",
    altKey: "hero.imageAlt.videographer",
  },
  {
    url: "https://images.unsplash.com/photo-1617463874381-85b513b3e991?q=80&w=800&auto=format&fit=crop",
    altKey: "hero.imageAlt.studio",
  },
] as const;

const HOW_IT_WORKS_KEYS = [
  { titleKey: "howItWorks.step1Title", descKey: "howItWorks.step1Desc" },
  { titleKey: "howItWorks.step2Title", descKey: "howItWorks.step2Desc" },
  { titleKey: "howItWorks.step3Title", descKey: "howItWorks.step3Desc" },
] as const;

export default async function LandingPage() {
  const t = await getTranslations();
  const tLanding = await getTranslations("publicPages.landing");

  const homeFeatures = [
    { icon: Search, title: t("home.f1t"), description: t("home.f1b") },
    { icon: CalendarCheck, title: t("home.f2t"), description: t("home.f2b") },
    // Marketplace-specific ("Rent or buy — camera shops and studios list
    // gear...") — hidden while MARKETPLACE_ENABLED=false.
    ...(features.marketplaceEnabled
      ? [
          {
            icon: ShoppingBag,
            title: t("home.f3t"),
            description: t("home.f3b"),
          },
        ]
      : []),
  ];

  const [featuredProfiles, realHeroPhotos] = await Promise.all([
    getFeaturedProfiles(4),
    getHeroPhotos(8),
  ]);

  // The contact sheet wants eight photos: four frames, each with a second
  // photograph to change to. Below that it shows what exists and simply
  // never changes — correct behaviour for a young marketplace, and it
  // fills in on its own as providers upload.
  //
  // Stock photographs are the fallback, not the default: a hero
  // advertising work nobody on the platform did is the most valuable
  // screen on the site spent on a lie. They only appear while there is
  // genuinely nothing real to show.
  const heroPhotos = [
    ...realHeroPhotos.map((photo) => ({
      url: photo.url,
      alt: photo.credit
        ? tLanding("heroPhotoAlt", { name: photo.credit })
        : t("hero.imageAlt.photographer"),
    })),
    ...FALLBACK_HERO_PHOTOS.map((photo) => ({
      url: photo.url,
      alt: t(photo.altKey),
    })),
  ].slice(0, 8);

  return (
    <>
      {/* SECTION 1 — HERO */}
      <section className="relative bg-green-900 text-gold-50">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-8 py-16 max-md:px-5">
          {/* Below lg both wrappers collapse to `contents`, so the heading,
              the paragraph and the search box below become direct children
              of this section's flex column and can be reordered. On a phone
              the intro paragraph runs five lines and pushed the search box —
              the only thing on this page anyone came to use — off the bottom
              of the screen; it now sits directly under the headline, with
              the paragraph after it. Desktop keeps the two-column layout. */}
          <div className="grid grid-cols-[1.05fr_1fr] items-center gap-14 max-lg:contents">
            <div className="flex flex-col gap-[22px] max-lg:contents">
              <h1 className="m-0 text-display-lg tracking-[-0.02em] sm:text-display-xl lg:text-display-2xl">
                {t("hero.title")}
              </h1>
              <p className="max-w-[460px] text-body-lg text-green-200 max-lg:order-2">
                {t("hero.sub")}
              </p>
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
                  city: profile.user.location ?? "",
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

      {/* SECTION 3 — FEATURES */}
      <section className="border-y border-border-subtle bg-bg-surface">
        <div
          className={`mx-auto grid max-w-[1440px] gap-8 px-8 py-16 max-md:grid-cols-1 max-md:px-5 ${
            features.marketplaceEnabled ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {homeFeatures.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col gap-2.5">
              <div className="flex size-11 items-center justify-center rounded-[var(--fg-radius-md)] bg-success-bg">
                <Icon className="size-[22px] text-brand-primary" />
              </div>
              <h3 className="text-heading-md text-text-primary">{title}</h3>
              <p className="text-body-md text-text-secondary">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS (not part of the real design strings — see comment above) */}
      <section
        id="how-it-works"
        className="mx-auto max-w-[1440px] px-8 py-[72px] max-md:px-5"
      >
        <SectionHead title={tLanding("howItWorks.heading")} />
        <div className="grid grid-cols-3 gap-8 max-md:grid-cols-1">
          {HOW_IT_WORKS_KEYS.map((step, index) => (
            <div key={step.titleKey} className="flex flex-col gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-brand-primary font-bold text-text-on-brand">
                {index + 1}
              </div>
              <h3 className="text-heading-md text-text-primary">
                {tLanding(step.titleKey)}
              </h3>
              <p className="text-body-md text-text-secondary">
                {tLanding(step.descKey)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5 — CTA */}
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
