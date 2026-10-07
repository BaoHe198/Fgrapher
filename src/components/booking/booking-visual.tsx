"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { buildMediaVariants } from "@/lib/media/variants";
import { minutesToTime, type SunTimes, timeToMinutes } from "@/lib/sun";
import { cn } from "@/lib/utils";

interface BookingVisualProps {
  /** Step index and its name, for the frame eyebrow. */
  step: number;
  stepName: string;
  /** The artist's own approved photos (up to six). */
  photos: string[];
  /** On the time step: the day's sun and the chosen start. */
  sun: SunTimes | null;
  time: string | null;
  showSky: boolean;
}

// The picture pane beside the booking steps (wave 2): the artist's real
// work as a contact sheet, and on the time step an illustration of where
// the sun will be at the chosen start - labelled as an illustration, since
// it is drawn, not photographed. Never stock pictures, never a claim about
// when a photo was taken that the data cannot back.
export function BookingVisual({
  step,
  stepName,
  photos,
  sun,
  time,
  showSky,
}: BookingVisualProps) {
  const t = useTranslations("sharedComponents.bookingVisual");
  // A plain step name - no frame numbers in a booking flow (Core MVP pass).
  const kicker = stepName;
  void step;

  let body: React.ReactNode = null;
  let caption: string | null = null;

  if (showSky && sun) {
    const minutes = time
      ? timeToMinutes(time)
      : Math.round((sun.sunrise + sun.sunset) / 2);
    const u = (minutes - sun.sunrise) / (sun.sunset - sun.sunrise);
    const daylight = u >= 0 && u <= 1;
    const left = 8 + Math.max(0, Math.min(1, u)) * 84;
    const top = daylight ? 72 - 58 * Math.sin(Math.PI * u) : 82;
    const warmth = !daylight ? "night" : u < 0.12 || u > 0.86 ? "gold" : "day";
    body = (
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          warmth === "gold" &&
            "bg-linear-to-b from-green-900 via-gold-700 via-55% to-gold-300",
          warmth === "day" &&
            "bg-linear-to-b from-green-800 via-green-600 via-60% to-gold-200",
          warmth === "night" &&
            "bg-linear-to-b from-green-950 via-green-900 via-70% to-green-800",
        )}
      >
        <span
          className={cn(
            "absolute aspect-square w-[clamp(48px,6vw,88px)] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,top] duration-[var(--fg-dur-400)] ease-fg-out motion-reduce:transition-none",
            warmth === "gold" &&
              "bg-gold-300 shadow-[0_0_60px_20px_color-mix(in_srgb,var(--gold-300)_45%,transparent)]",
            warmth === "day" &&
              "bg-gold-100 shadow-[0_0_60px_20px_color-mix(in_srgb,var(--gold-300)_45%,transparent)]",
            warmth === "night" && "bg-neutral-300 opacity-60",
          )}
          style={{ left: `${left}%`, top: `${top}%` }}
        />
        <span className="absolute inset-x-0 bottom-0 h-[26%] bg-green-950 [clip-path:polygon(0_38%,14%_22%,28%_34%,44%_12%,60%_30%,76%_18%,100%_32%,100%_100%,0_100%)]" />
      </div>
    );
    caption = time
      ? t("skyAt", { time })
      : t("skyPick", {
          rise: minutesToTime(sun.sunrise),
          set: minutesToTime(sun.sunset),
        });
  } else if (photos.length > 0) {
    const sheet = photos.slice(0, 6);
    body = (
      <div
        className={cn(
          "absolute inset-0 grid gap-[3px] bg-dr-line p-[3px]",
          sheet.length === 1
            ? "grid-cols-1"
            : sheet.length <= 4
              ? "grid-cols-2"
              : "grid-cols-3 grid-rows-2",
        )}
      >
        {sheet.map((src) => (
          <span key={src} className="relative block bg-dr-surface">
            <Image
              src={buildMediaVariants(src).medium}
              alt=""
              fill
              unoptimized
              sizes="200px"
              className="object-contain p-1.5"
            />
          </span>
        ))}
      </div>
    );
    caption = t("portfolio");
  } else {
    return null;
  }

  return (
    <figure className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--fg-radius-lg)] bg-dr-bg text-dr-text">
      {body}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-[hsl(30_14%_5%/0.86)] to-transparent"
      />
      <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-[clamp(14px,2vw,24px)]">
        <span className="text-body-sm font-semibold text-on-photo-2">
          {kicker}
        </span>
        {caption ? (
          <span className="text-[15px] leading-[1.45] font-medium text-pretty text-on-photo">
            {caption}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
