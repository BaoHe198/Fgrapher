"use client";

import { useTranslations } from "next-intl";

import { ServiceAreaMapLazy } from "@/components/profile/service-area-map-lazy";
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

// Where a studio is and when it is open (25/11/2026).
//
// A studio that chose to show where it is (project owner, 26/11/2026) gets
// its street address, a map with a pin and a directions link: `address` and
// `point.exact` are only ever set for such a studio (profile-area.ts).
// Any other studio keeps ward and province only, an area on the map, and
// the line telling the customer how to get the address.
export function StudioPlace({
  location,
  address,
  point,
  hours,
}: {
  location: string | null;
  /** Number and street, when the studio shows it; else null. */
  address: string | null;
  point: { latitude: number; longitude: number; exact: boolean } | null;
  hours: StudioHours[];
}) {
  const t = useTranslations("publicPages.profile.studio");
  const dayT = useTranslations("dashboardSettings.profile.availability.days");
  return (
    <dl className="flex flex-col gap-5 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5">
      <div className="flex flex-col gap-1 text-body-sm">
        <dt className="text-text-secondary">{t("address")}</dt>
        <dd className="flex flex-col gap-0.5">
          {address ? (
            <span className="text-body-md font-semibold! [overflow-wrap:anywhere] text-text-primary">
              {address}
            </span>
          ) : null}
          {location ? (
            <span
              className={
                address
                  ? "text-text-secondary"
                  : "text-body-md font-semibold! text-text-primary"
              }
            >
              {location}
            </span>
          ) : null}
          {address ? null : (
            <span className="text-text-secondary">{t("addressNote")}</span>
          )}
        </dd>
      </div>
      {point ? (
        <div className="flex flex-col gap-2">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-sunken">
            <ServiceAreaMapLazy
              latitude={point.latitude}
              longitude={point.longitude}
              radiusKm={null}
              pin={point.exact}
              label={t("mapLabel", { place: address ?? location ?? "" })}
            />
          </div>
          {point.exact ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-body-sm font-semibold! text-text-link underline underline-offset-4"
            >
              {t("directions")}
            </a>
          ) : (
            <p className="text-meta text-text-tertiary">{t("approximate")}</p>
          )}
        </div>
      ) : null}
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
