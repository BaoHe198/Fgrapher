"use client";

import { useTranslations } from "next-intl";

import { FgImage } from "@/components/ui/fg-image";
import { buildMediaVariants } from "@/lib/media/variants";

// A studio's "Không gian" (redesign 09/2026, audit §06): the room as a
// contact-sheet strip with frame numbers, at each photo's real ratio,
// rather than one big tile and two small ones - then its size and what it
// comes with.
export function StudioSpace({
  photos,
  area,
  amenities,
}: {
  photos: string[];
  area: number | null;
  amenities: string[];
}) {
  const t = useTranslations("publicPages.profile.studio");
  const amenityT = useTranslations(
    "dashboardSettings.profile.editor.amenities",
  );
  return (
    <div className="flex flex-col gap-5">
      {photos.length > 0 ? (
        <ol className="-mx-5 flex snap-x gap-2 overflow-x-auto rounded-none bg-green-950 px-5 py-3 [scrollbar-width:none] sm:mx-0 sm:rounded-[var(--fg-radius-lg)] [&::-webkit-scrollbar]:hidden">
          {photos.slice(0, 8).map((url, index) => (
            <li
              key={url}
              className="flex w-44 shrink-0 snap-start flex-col gap-1.5"
            >
              <FgImage
                src={buildMediaVariants(url).medium}
                alt=""
                ratio="4/3"
                rounded="none"
                revealIndex={index}
                sizes="176px"
              />
              <span className="font-mono text-meta text-gold-400 tabular-nums">
                {String(index + 1).padStart(2, "0")}A
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {area || amenities.length > 0 ? (
        <dl className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
          {area ? (
            <div className="flex items-baseline justify-between gap-4 text-body-sm">
              <dt className="text-text-secondary">{t("area")}</dt>
              <dd className="font-mono font-semibold! text-text-primary">
                {t("squareMeters", { area })}
              </dd>
            </div>
          ) : null}
          {amenities.length > 0 ? (
            <div className="flex flex-col gap-2 text-body-sm">
              <dt className="text-text-secondary">{t("amenities")}</dt>
              <dd className="flex flex-wrap gap-2">
                {amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="rounded-full bg-bg-sunken px-3 py-1 text-body-sm text-text-primary"
                  >
                    {amenityT(amenity)}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
