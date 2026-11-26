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
  roomCount,
  capacity,
  amenities,
}: {
  photos: string[];
  area: number | null;
  roomCount: number | null;
  capacity: number | null;
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
            </li>
          ))}
        </ol>
      ) : null}
      {area || roomCount || capacity || amenities.length > 0 ? (
        <dl className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
          {area ? (
            <div className="flex items-baseline justify-between gap-4 text-body-sm">
              <dt className="text-text-secondary">{t("area")}</dt>
              <dd className="font-mono font-semibold! text-text-primary">
                {t("squareMeters", { area })}
              </dd>
            </div>
          ) : null}
          {roomCount ? (
            <div className="flex items-baseline justify-between gap-4 text-body-sm">
              <dt className="text-text-secondary">{t("rooms")}</dt>
              <dd className="font-mono font-semibold! text-text-primary">
                {roomCount}
              </dd>
            </div>
          ) : null}
          {capacity ? (
            <div className="flex items-baseline justify-between gap-4 text-body-sm">
              <dt className="text-text-secondary">{t("capacity")}</dt>
              <dd className="font-mono font-semibold! text-text-primary">
                {t("people", { count: capacity })}
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

export interface StudioHours {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

// Monday first, the way the calendar is drawn everywhere else in the app.
const WEEK = [
  { dayOfWeek: 1, key: "mon" },
  { dayOfWeek: 2, key: "tue" },
  { dayOfWeek: 3, key: "wed" },
  { dayOfWeek: 4, key: "thu" },
  { dayOfWeek: 5, key: "fri" },
  { dayOfWeek: 6, key: "sat" },
  { dayOfWeek: 0, key: "sun" },
] as const;

// Where a studio is and when it is open (25/11/2026). Ward and province
// only: the street address is private for every provider (Profile.address),
// so the customer is told how to get it rather than shown it.
export function StudioPlace({
  location,
  hours,
}: {
  location: string | null;
  hours: StudioHours[];
}) {
  const t = useTranslations("publicPages.profile.studio");
  const dayT = useTranslations("dashboardSettings.profile.availability.days");
  return (
    <dl className="flex flex-col gap-5 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-col gap-1 text-body-sm">
        <dt className="text-text-secondary">{t("address")}</dt>
        <dd className="flex flex-col gap-0.5">
          {location ? (
            <span className="text-body-md font-semibold! text-text-primary">
              {location}
            </span>
          ) : null}
          <span className="text-text-secondary">{t("addressNote")}</span>
        </dd>
      </div>
      {hours.length > 0 ? (
        <div className="flex flex-col gap-2 text-body-sm">
          <dt className="text-text-secondary">{t("hours")}</dt>
          <dd>
            <ul className="flex flex-col gap-1.5">
              {WEEK.map(({ dayOfWeek, key }) => {
                const windows = hours
                  .filter((rule) => rule.dayOfWeek === dayOfWeek)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
                return (
                  <li
                    key={key}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <span className="text-text-primary">{dayT(key)}</span>
                    <span
                      className={
                        windows.length > 0
                          ? "font-mono font-semibold! tabular-nums text-text-primary"
                          : "text-text-tertiary"
                      }
                    >
                      {windows.length > 0
                        ? windows
                            .map(
                              (rule) => `${rule.startTime} – ${rule.endTime}`,
                            )
                            .join(", ")
                        : t("closed")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
