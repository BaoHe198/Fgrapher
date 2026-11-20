"use client";

import { useRef } from "react";

import type { AgendaKind } from "@/lib/calendar/agenda";
import { WEEKDAY_SHORT_LABELS_VI } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface DaySummary {
  /** Bookings and own entries on the day, in time order. */
  jobs: Exclude<AgendaKind, "BLOCK">[];
  blocked: boolean;
}

interface WeekStripProps {
  /** Seven day keys, Monday first. */
  days: string[];
  selected: string;
  todayKey: string;
  summaries: Map<string, DaySummary>;
  onSelect: (dateKey: string) => void;
  /** A swipe left or right moves a week on or back. */
  onSwipe: (direction: 1 | -1) => void;
  label: string;
  /** Spoken name of a day button, e.g. "Thứ Tư, 25/11/2026, 2 việc". */
  describeDay: (dateKey: string, jobs: number) => string;
}

export const KIND_DOT: Record<AgendaKind, string> = {
  BOOKING: "bg-success",
  ENTRY: "bg-gold-400",
  BLOCK: "bg-text-tertiary",
};

const SWIPE_MIN_PX = 48;

/**
 * The phone's way around the calendar: one week across the screen, each day
 * a full-height tap target with a dot per job, and the chosen day's jobs
 * listed underneath. A month grid on a phone gives each day a 50px square —
 * enough to see that something is there, not to read it or press it.
 */
export function WeekStrip({
  days,
  selected,
  todayKey,
  summaries,
  onSelect,
  onSwipe,
  label,
  describeDay,
}: WeekStripProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      role="group"
      aria-label={label}
      className="grid touch-pan-y grid-cols-7 gap-1"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        // Mostly sideways, and far enough to be meant.
        if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
          onSwipe(dx < 0 ? 1 : -1);
        }
      }}
    >
      {days.map((dateKey, index) => {
        const summary = summaries.get(dateKey);
        const jobs = summary?.jobs ?? [];
        const isSelected = dateKey === selected;
        const isToday = dateKey === todayKey;
        return (
          <button
            key={dateKey}
            type="button"
            aria-pressed={isSelected}
            aria-current={isToday ? "date" : undefined}
            aria-label={describeDay(dateKey, jobs.length)}
            onClick={() => onSelect(dateKey)}
            className={cn(
              "focus-ring flex min-h-[68px] flex-col items-center gap-1 rounded-[var(--fg-radius-md)] px-0.5 py-2 transition-colors",
              isSelected
                ? "bg-brand-primary text-text-on-brand"
                : "text-text-primary hover:bg-bg-sunken",
              !isSelected && summary?.blocked && "bg-bg-sunken",
            )}
          >
            <span
              className={cn(
                "text-meta font-semibold! tracking-[0.06em] uppercase",
                isSelected ? "text-text-on-brand" : "text-text-tertiary",
              )}
            >
              {WEEKDAY_SHORT_LABELS_VI[index]}
            </span>
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-body-md font-semibold! tabular-nums",
                isToday && !isSelected && "ring-2 ring-gold-400",
                isToday && isSelected && "ring-2 ring-text-on-brand",
              )}
            >
              {Number(dateKey.slice(8, 10))}
            </span>
            <span aria-hidden className="flex h-1.5 items-center gap-0.5">
              {jobs.slice(0, 3).map((kind, dot) => (
                <span
                  key={dot}
                  className={cn(
                    "size-1.5 rounded-full",
                    isSelected ? "bg-text-on-brand" : KIND_DOT[kind],
                  )}
                />
              ))}
              {jobs.length === 0 && summary?.blocked ? (
                <span
                  className={cn(
                    "h-0.5 w-3 rounded-full",
                    isSelected ? "bg-text-on-brand" : KIND_DOT.BLOCK,
                  )}
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
