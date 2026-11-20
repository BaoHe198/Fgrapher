"use client";

import {
  type AgendaItem,
  addDays,
  agendaKey,
  weekdayOf,
} from "@/lib/calendar/agenda";
import { WEEKDAY_SHORT_LABELS_VI } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { KIND_DOT } from "./week-strip";

interface MonthGridProps {
  /** Any day in the month to draw. */
  monthOf: string;
  /** First and last (exclusive) day keys of the loaded window. */
  from: string;
  to: string;
  selected: string;
  todayKey: string;
  byDay: Map<string, AgendaItem[]>;
  /** Weekdays (0 = Sunday) the provider takes bookings on. */
  workingWeekdays: Set<number>;
  onSelect: (dateKey: string) => void;
  describeDay: (dateKey: string, jobs: number) => string;
  labels: {
    allDayBusy: string;
    customJob: string;
    more: (n: number) => string;
  };
}

/**
 * The wide-screen overview: the whole month, each day a cell with its first
 * few jobs. Choosing a day fills the panel beside it. Not shown on a phone,
 * where the week strip does this job (see week-strip.tsx for why).
 */
export function MonthGrid({
  monthOf,
  from,
  to,
  selected,
  todayKey,
  byDay,
  workingWeekdays,
  onSelect,
  describeDay,
  labels,
}: MonthGridProps) {
  const days: string[] = [];
  for (let day = from; day < to; day = addDays(day, 1)) days.push(day);
  const month = monthOf.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-[var(--fg-radius-lg)] border border-border-subtle bg-surface-card">
      <div className="grid grid-cols-7 border-b border-border-subtle text-caption-upper tracking-[0.12em] text-text-tertiary">
        {WEEKDAY_SHORT_LABELS_VI.map((label) => (
          <div key={label} className="px-2 py-2.5 text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((dateKey) => {
          const items = byDay.get(dateKey) ?? [];
          const jobs = items.filter((item) => item.kind !== "BLOCK");
          const wholeDayBlock = items.some(
            (item) => item.kind === "BLOCK" && !item.startTime,
          );
          const outside = dateKey.slice(0, 7) !== month;
          const closed = !workingWeekdays.has(weekdayOf(dateKey));
          const isSelected = dateKey === selected;
          return (
            <button
              key={dateKey}
              type="button"
              aria-pressed={isSelected}
              aria-current={dateKey === todayKey ? "date" : undefined}
              aria-label={describeDay(dateKey, jobs.length)}
              onClick={() => onSelect(dateKey)}
              className={cn(
                "focus-ring flex min-h-[104px] flex-col gap-1 border-r border-b border-border-subtle p-1.5 text-left hover:bg-bg-sunken",
                wholeDayBlock && "bg-bg-sunken",
                !wholeDayBlock && closed && !outside && "bg-warning-bg/30",
                outside && "opacity-50",
                isSelected && "ring-2 ring-border-focus ring-inset",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-body-sm font-semibold! tabular-nums",
                  dateKey === todayKey
                    ? "bg-brand-primary text-text-on-brand"
                    : dateKey < todayKey
                      ? "text-text-tertiary"
                      : "text-text-primary",
                )}
              >
                {Number(dateKey.slice(8, 10))}
              </span>
              {wholeDayBlock ? (
                <span className="truncate text-meta text-text-tertiary">
                  {labels.allDayBusy}
                </span>
              ) : null}
              {jobs.slice(0, 3).map((item) => (
                <span
                  key={agendaKey(item)}
                  className="flex items-center gap-1 text-meta text-text-secondary"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      KIND_DOT[item.kind],
                    )}
                  />
                  <span className="truncate">
                    <span className="tabular-nums">{item.startTime}</span>{" "}
                    {item.customerName ?? (item.title || labels.customJob)}
                  </span>
                </span>
              ))}
              {jobs.length > 3 ? (
                <span className="text-meta text-text-tertiary">
                  {labels.more(jobs.length - 3)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
