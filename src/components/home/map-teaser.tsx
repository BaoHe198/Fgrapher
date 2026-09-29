import { BadgeCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { MapMarker } from "@/components/fmap/map-marker";
import { Button } from "@/components/ui/button";
import { FgImage } from "@/components/ui/fg-image";
import { RiseOnView } from "@/components/ui/rise-on-view";
import { formatCurrency } from "@/lib/utils";

interface TeaserArtist {
  id: string;
  name: string;
  photoUrl: string | null;
  priceMin: number | null;
  location: string;
  roleLabel: string;
}

// Where each frame sits on the drawn map, in % of the card. Hand-placed so
// the frames never collide with the chips (top) or the preview card
// (bottom-left) at any width the card takes.
const SPOTS = [
  "left-[58%] top-[40%]",
  "left-[34%] top-[30%]",
  "left-[80%] top-[26%]",
  "left-[48%] top-[62%]",
  "left-[84%] top-[62%]",
];

// "Bản đồ F" teaser. A drawing of the map, not the map itself: loading
// MapLibre and tiles on the home page would cost every visitor for a
// section most scroll past. The frames are real featured artists, with the
// same marker the real map uses, and the whole card opens /fmap.
export async function MapTeaser({ artists }: { artists: TeaserArtist[] }) {
  const t = await getTranslations("home.map");
  const [first] = artists;
  return (
    <section className="mx-auto grid max-w-[1440px] grid-cols-[5fr_7fr] items-center gap-12 px-8 pt-20 max-lg:grid-cols-1 max-lg:gap-8 max-md:hidden">
      <div className="flex flex-col gap-4">
        <span className="font-mono text-meta tracking-[0.12em] text-gold-700 uppercase dark:text-gold-400">
          {t("eyebrow")}
        </span>
        <RiseOnView>
          <h2 className="max-w-sm text-display-md text-text-primary">
            {t("title")}
          </h2>
        </RiseOnView>
        <p className="max-w-md text-body-md text-text-secondary">{t("sub")}</p>
        <Button
          className="mt-2 self-start"
          nativeButton={false}
          render={<Link href="/fmap" />}
        >
          {t("cta")}
        </Button>
      </div>

      <Link
        href="/fmap"
        aria-label={t("previewLabel")}
        className="group/map focus-ring relative block aspect-[16/10] overflow-hidden rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-sunken"
      >
        {/* Street grid and two main roads, drawn in CSS. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(var(--border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--border-subtle)_1px,transparent_1px)] bg-[size:36px_36px]"
        />
        <span
          aria-hidden
          className="absolute top-[18%] -left-[10%] h-5 w-[130%] rotate-[24deg] bg-bg-surface"
        />
        <span
          aria-hidden
          className="absolute top-[70%] -left-[10%] h-4 w-[130%] -rotate-[12deg] bg-bg-surface"
        />

        <span className="absolute top-4 left-4 flex flex-wrap gap-2">
          {[first?.roleLabel, t("chipStyle"), t("chipBudget")]
            .filter(Boolean)
            .map((chip, index) => (
              <span
                key={chip}
                className={
                  index === 0
                    ? "rounded-full bg-brand-primary px-3 py-1 text-meta text-text-on-brand"
                    : "rounded-full border border-border-default bg-bg-surface px-3 py-1 text-meta text-text-secondary"
                }
              >
                {chip}
              </span>
            ))}
        </span>

        {artists.slice(0, SPOTS.length).map((artist, index) => (
          <span
            key={artist.id}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${SPOTS[index]}`}
          >
            <MapMarker
              label={artist.name}
              photoUrl={artist.photoUrl}
              price={artist.priceMin}
              selected={index === 0}
            />
          </span>
        ))}

        {first ? (
          <span className="absolute bottom-4 left-4 flex w-[min(300px,calc(100%-2rem))] items-center gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle bg-surface-card p-2.5 shadow-[var(--shadow-lg)] transition-transform duration-[var(--fg-dur-260)] ease-fg-out group-hover/map:-translate-y-0.5">
            <FgImage
              src={first.photoUrl}
              alt=""
              ratio="1/1"
              reveal={false}
              sizes="56px"
              className="w-14 shrink-0"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-body-sm font-semibold! text-text-primary">
                {first.name}
              </span>
              <span className="flex items-center gap-1 text-meta text-brand-primary">
                <BadgeCheck aria-hidden className="size-3" />
                {t("verified")}
              </span>
              <span className="truncate text-meta text-text-tertiary">
                {first.location}
                {first.priceMin ? ` · ${formatCurrency(first.priceMin)}` : ""}
              </span>
            </span>
          </span>
        ) : null}
      </Link>
    </section>
  );
}
