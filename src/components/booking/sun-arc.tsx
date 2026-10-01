"use client";

import { useTranslations } from "next-intl";

import { minutesToTime, type SunTimes, timeToMinutes } from "@/lib/sun";
import { cn } from "@/lib/utils";

interface SunArcSlot {
  start: string;
  status: "available" | "booked";
  golden: boolean;
}

interface SunArcProps {
  sun: SunTimes;
  slots: SunArcSlot[];
  selected: string | null;
  onSelect: (time: string) => void;
}

// The day as the sun draws it (wave 2 booking): an arc from sunrise to
// sunset over a horizon, night shaded either side, every open slot a mark
// on the arc where the sun will be - golden-hour marks glow, booked ones
// are dashed - and the sun sitting at the chosen time. The marks repeat
// the slot grid below for pointer users; keyboard and screen-reader users
// get the grid, so the drawing itself is hidden from assistive tech.
export function SunArc({ sun, slots, selected, onSelect }: SunArcProps) {
  const t = useTranslations("sharedComponents.sunArc");

  // The visible span: an hour before sunrise to an hour and a half after
  // sunset, widened to cover any slot outside it.
  const starts = slots.map((slot) => timeToMinutes(slot.start));
  const from = Math.min(sun.sunrise - 60, ...starts);
  const to = Math.max(sun.sunset + 90, ...starts);
  const x = (minutes: number) => ((minutes - from) / (to - from)) * 1000;
  const HORIZON = 176;
  const HEIGHT = 150;
  const y = (minutes: number) => {
    const u = (minutes - sun.sunrise) / (sun.sunset - sun.sunrise);
    return u < 0 || u > 1 ? HORIZON : HORIZON - HEIGHT * Math.sin(Math.PI * u);
  };

  const steps = 48;
  const arc = Array.from({ length: steps + 1 }, (_, i) => {
    const m = sun.sunrise + ((sun.sunset - sun.sunrise) * i) / steps;
    return `${i === 0 ? "M" : "L"}${x(m).toFixed(1)},${y(m).toFixed(1)}`;
  }).join(" ");
  const sunAt = selected
    ? timeToMinutes(selected)
    : Math.round((sun.sunrise + sun.sunset) / 2);

  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-body-sm text-text-secondary">
        <strong className="font-semibold text-text-primary">
          {t("riseSet", {
            rise: minutesToTime(sun.sunrise),
            set: minutesToTime(sun.sunset),
          })}
        </strong>
        <span>{t("clock")}</span>
      </p>
      <div aria-hidden className="relative mx-1.5 h-[clamp(170px,18vw,230px)]">
        <svg
          viewBox="0 0 1000 220"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <linearGradient id="fg-sun-arc" x1="0" x2="1">
              <stop offset="0" stopColor="var(--gold-400)" />
              <stop offset=".22" stopColor="var(--gold-200)" />
              <stop offset=".78" stopColor="var(--gold-200)" />
              <stop offset="1" stopColor="var(--gold-400)" />
            </linearGradient>
          </defs>
          <rect
            x="0"
            y={HORIZON}
            width={x(sun.sunrise)}
            height="44"
            fill="var(--bg-sunken)"
          />
          <rect
            x={x(sun.sunset)}
            y={HORIZON}
            width={1000 - x(sun.sunset)}
            height="44"
            fill="var(--bg-sunken)"
          />
          <line
            x1="0"
            y1={HORIZON}
            x2="1000"
            y2={HORIZON}
            stroke="var(--border-default)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={arc}
            fill="none"
            stroke="url(#fg-sun-arc)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Round marks as HTML, so they stay round in a stretched SVG. */}
        <span
          className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg-page bg-gold-400 transition-[left,top] duration-[var(--fg-dur-320)] ease-fg-out motion-reduce:transition-none"
          style={{
            left: `${x(sunAt) / 10}%`,
            top: `${(y(sunAt) / 220) * 100}%`,
          }}
        />
        <span
          className="absolute top-[86%] -translate-x-1/2 font-mono text-meta whitespace-nowrap text-text-secondary"
          style={{ left: `${x(sun.sunrise) / 10}%` }}
        >
          ↑ {minutesToTime(sun.sunrise)}
        </span>
        <span
          className="absolute top-[86%] -translate-x-1/2 font-mono text-meta whitespace-nowrap text-text-secondary"
          style={{ left: `${x(sun.sunset) / 10}%` }}
        >
          ↓ {minutesToTime(sun.sunset)}
        </span>
        {slots.map((slot) => {
          const m = timeToMinutes(slot.start);
          const on = slot.start === selected;
          const booked = slot.status === "booked";
          return (
            <button
              key={slot.start}
              type="button"
              tabIndex={-1}
              disabled={booked}
              onClick={() => onSelect(slot.start)}
              className={cn(
                "absolute size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-transform duration-[var(--fg-dur-150)] motion-reduce:transition-none",
                on
                  ? "scale-[1.35] border-brand-primary bg-brand-primary"
                  : booked
                    ? "cursor-not-allowed border-dashed border-border-strong bg-bg-page"
                    : slot.golden
                      ? "border-gold-600 bg-gold-400 shadow-[0_0_0_6px_color-mix(in_srgb,var(--gold-400)_30%,transparent),0_0_18px_var(--gold-300)]"
                      : "border-text-primary bg-bg-page hover:scale-110",
              )}
              style={{
                left: `${x(m) / 10}%`,
                top: `${(y(m) / 220) * 100}%`,
              }}
            />
          );
        })}
      </div>
      <p className="text-meta text-text-tertiary">{t("goldenNote")}</p>
    </div>
  );
}
