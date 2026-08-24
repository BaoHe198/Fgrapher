import { CalendarCheck, Search, ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ArtistCard } from "@/components/cards/artist-card";
import { HeroSearch } from "@/components/sections/hero-search";
import { Button } from "@/components/ui/button";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { SectionHead } from "@/components/ui/section-head";
import { minMonthlyPrice } from "@/lib/constants/plans";
import { features } from "@/lib/features";
import { formatCurrency } from "@/lib/utils";
import { getFeaturedProfiles } from "@/services/search";

// phase-1 Step 6 invented this 3-step section — there is no corresponding
// content in the design's real i18n strings (window.FG_STRINGS). Now
// wired to publicPages.landing per CLAUDE.md rule #10 (full Vietnamese UI).
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

  const featuredProfiles = await getFeaturedProfiles(4);

  return (
    <>
      {/* SECTION 1 — HERO */}
      <section className="relative bg-green-900 text-gold-50">
        <div className="mx-auto grid min-h-[520px] max-w-[1240px] grid-cols-[1.05fr_1fr] items-center gap-14 px-8 max-lg:grid-cols-1 max-md:px-5">
          <div className="flex flex-col gap-[22px] py-16">
            <span className="text-caption-upper tracking-[0.14em] text-gold-300">
              {t("hero.eyebrow")}
            </span>
            <h1 className="m-0 text-display-2xl tracking-[-0.02em]">
              {t("hero.title")}
            </h1>
            <p className="max-w-[460px] text-body-lg text-green-200">
              {t("hero.sub")}
            </p>

            <HeroSearch marketplaceEnabled={features.marketplaceEnabled} />
          </div>

          <div className="grid grid-cols-2 gap-3 py-10 max-lg:hidden">
            <div className="flex flex-col gap-3">
              <MediaPlaceholder tint="green-300" height={200} radius={16} />
              <MediaPlaceholder tint="gold-200" height={140} radius={16} />
            </div>
            <div className="flex flex-col gap-3 pt-[34px]">
              <MediaPlaceholder tint="neutral-300" height={150} radius={16} />
              <MediaPlaceholder tint="green-200" height={190} radius={16} />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — FEATURED ARTISTS */}
      {featuredProfiles.length > 0 ? (
        <section className="mx-auto max-w-[1240px] px-8 py-[72px] max-md:px-5">
          <SectionHead
            title={t("home.featured")}
            actionLabel={t("home.seeAll")}
            actionHref="/browse"
          />
          <div className="grid grid-cols-4 gap-5 max-lg:grid-cols-2 max-md:grid-cols-1">
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
                  coverImage: profile.media[0]?.url,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* SECTION 3 — FEATURES */}
      <section className="border-y border-border-subtle bg-bg-surface">
        <div
          className={`mx-auto grid max-w-[1240px] gap-8 px-8 py-16 max-md:grid-cols-1 max-md:px-5 ${
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
        className="mx-auto max-w-[1240px] px-8 py-[72px] max-md:px-5"
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
        <div className="mx-auto max-w-[1240px] px-8 py-20 text-center max-md:px-5">
          <h2 className="text-display-lg">{t("home.ctaTitle")}</h2>
          <p className="mx-auto max-w-[520px] text-body-lg text-green-200">
            {t("home.ctaSub", {
              price: formatCurrency(minMonthlyPrice(), "VND"),
            })}
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
