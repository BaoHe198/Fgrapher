import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { PlaceCard } from "@/components/places/place-card";
import type { PlaceCard as PlaceCardData } from "@/services/places";

/**
 * "Địa điểm chụp đẹp" on the home page — the way in to the photo spots,
 * which visitors otherwise only met through a switch on Fmap (21/11
 * walk-through). Rendered only once spots exist (the page checks).
 */
export async function PlacesTeaser({ places }: { places: PlaceCardData[] }) {
  const t = await getTranslations("places.home");
  return (
    <section
      aria-labelledby="home-places"
      className="border-b border-border-subtle bg-bg-page py-12 max-md:py-8"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-8 max-md:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex max-w-2xl flex-col gap-1.5">
            <h2 id="home-places" className="text-heading-xl text-text-primary">
              {t("title")}
            </h2>
            <p className="text-body-md text-text-secondary">{t("lede")}</p>
          </div>
          <Link
            href="/dia-diem"
            className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--fg-radius-sm)] text-body-md font-semibold text-text-link hover:underline"
          >
            {t("seeAll")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        {/* A swipeable row on a phone, a grid from tablet up. */}
        <ul className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {places.map((place) => (
            <li
              key={place.id}
              className="w-[78%] shrink-0 snap-start md:w-auto md:min-w-0"
            >
              <PlaceCard place={place} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
