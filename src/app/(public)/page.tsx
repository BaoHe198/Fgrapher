import { CalendarCheck, Search, ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ArtistCard } from "@/components/cards/artist-card";
import { HeroSearch } from "@/components/sections/hero-search";
import { Button } from "@/components/ui/button";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { SectionHead } from "@/components/ui/section-head";

const FEATURED_ARTISTS = [
  {
    id: "1",
    name: "Ana Reyes",
    username: "ana-reyes",
    roleKey: "Photographer",
    city: "Manila",
    rating: 4.9,
    reviews: 128,
    price: "From $150/session",
    tint: "green-300",
  },
  {
    id: "2",
    name: "Leo Cruz",
    username: "leo-cruz",
    roleKey: "Videographer",
    city: "Cebu",
    rating: 5.0,
    reviews: 23,
    price: "From $600/day",
    tint: "gold-200",
  },
  {
    id: "3",
    name: "Mika Tan",
    username: "mika-tan",
    roleKey: "Make-up Artist",
    city: "Makati",
    rating: 4.8,
    reviews: 64,
    price: "From $90/look",
    tint: "neutral-300",
  },
  {
    id: "4",
    name: "Studio Nine",
    username: "studio-nine",
    roleKey: "Studio",
    city: "Quezon City",
    rating: 4.7,
    reviews: 41,
    price: "From $80/hr",
    tint: "green-200",
  },
] as const;

// phase-1 Step 6 invented this 3-step section — there is no corresponding
// content in the design's real i18n strings (window.FG_STRINGS), so it stays
// English-only until real copy exists for it.
const HOW_IT_WORKS = [
  {
    title: "Search & compare",
    description:
      "Browse verified profiles, compare pricing, and read real reviews.",
  },
  {
    title: "Book your date",
    description:
      "Message the artist, pick a slot, and confirm your booking online.",
  },
  {
    title: "Get your shoot",
    description:
      "Meet up, get creative, and receive your final files through Fgrapher.",
  },
];

export default async function LandingPage() {
  const t = await getTranslations();

  const features = [
    { icon: Search, title: t("home.f1t"), description: t("home.f1b") },
    { icon: CalendarCheck, title: t("home.f2t"), description: t("home.f2b") },
    { icon: ShoppingBag, title: t("home.f3t"), description: t("home.f3b") },
  ];

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

            <HeroSearch />
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
      <section className="mx-auto max-w-[1240px] px-8 py-[72px] max-md:px-5">
        <SectionHead
          title={t("home.featured")}
          actionLabel={t("home.seeAll")}
          actionHref="/browse"
        />
        <div className="grid grid-cols-4 gap-5 max-lg:grid-cols-2 max-md:grid-cols-1">
          {FEATURED_ARTISTS.map(({ roleKey, ...artist }) => (
            <ArtistCard
              key={artist.id}
              artist={{ ...artist, role: t(`role.${roleKey}`) }}
            />
          ))}
        </div>
      </section>

      {/* SECTION 3 — FEATURES */}
      <section className="border-y border-border-subtle bg-bg-surface">
        <div className="mx-auto grid max-w-[1240px] grid-cols-3 gap-8 px-8 py-16 max-md:grid-cols-1 max-md:px-5">
          {features.map(({ icon: Icon, title, description }) => (
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
        <SectionHead title="How it works" />
        <div className="grid grid-cols-3 gap-8 max-md:grid-cols-1">
          {HOW_IT_WORKS.map((step, index) => (
            <div key={step.title} className="flex flex-col gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-brand-primary font-bold text-text-on-brand">
                {index + 1}
              </div>
              <h3 className="text-heading-md text-text-primary">
                {step.title}
              </h3>
              <p className="text-body-md text-text-secondary">
                {step.description}
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
            {t("home.ctaSub")}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="accent"
              nativeButton={false}
              render={<Link href="/register" />}
            >
              {t("home.ctaBtn")}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
