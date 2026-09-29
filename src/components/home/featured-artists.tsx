"use client";

import type { ProfileCategory } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ArtistCard } from "@/components/cards/artist-card";
import { cn } from "@/lib/utils";

type ArtistCardData = React.ComponentProps<typeof ArtistCard>["artist"];

interface FeaturedArtistsProps {
  artists: (ArtistCardData & { categories: ProfileCategory[] })[];
  /** Style chips offered on phones, in display order. */
  styles: ProfileCategory[];
}

// The featured grid. On a desktop it is four cards across; on a phone it
// is a single column with style chips above it (redesign 09/2026 mobile
// home) that narrow the list in place - a chip only appears when at least
// one featured artist actually shoots that style, so none ever empties the
// list.
export function FeaturedArtists({ artists, styles }: FeaturedArtistsProps) {
  const t = useTranslations();
  const available = styles.filter((style) =>
    artists.some((artist) => artist.categories.includes(style)),
  );
  const [style, setStyle] = useState<ProfileCategory | null>(null);
  const shown = style
    ? artists.filter((artist) => artist.categories.includes(style))
    : artists;

  return (
    <>
      {available.length > 0 ? (
        <div
          role="group"
          aria-label={t("home.stylesTitle")}
          className="mb-4 flex flex-wrap gap-2 md:hidden"
        >
          {[null, ...available].map((value) => {
            const active = value === style;
            return (
              <button
                key={value ?? "all"}
                type="button"
                data-interactive="true"
                aria-pressed={active}
                onClick={() => setStyle(value)}
                className={cn(
                  "focus-ring rounded-full border px-3.5 py-1.5 text-body-sm transition-colors duration-[var(--fg-dur-150)]",
                  active
                    ? "border-brand-primary bg-brand-primary text-text-on-brand"
                    : "border-border-default bg-bg-surface text-text-primary hover:border-border-strong",
                )}
              >
                {value ? t(`profileCategory.${value}`) : t("home.allStyles")}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="grid grid-cols-4 gap-5 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-4">
        {shown.map((artist, index) => (
          <div
            key={artist.id}
            // Three on a phone, where each card is a full screen of scroll.
            className={cn(index >= 3 && "max-md:hidden")}
          >
            <ArtistCard artist={artist} priority={index < 2} />
          </div>
        ))}
      </div>
    </>
  );
}
