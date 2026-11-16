"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/lib/utils";

interface MultiDateCalendarProps {
  /** Chosen days, "yyyy-MM-dd". */
  value: string[];
  onChange: (value: string[]) => void;
  /** First day that can be chosen, "yyyy-MM-dd" (today, Vietnam time). */
  min: string;
  /** Most days that can be chosen at once. */
  maxCount: number;
  label?: string;
  className?: string;
}

// Day keys are calendar dates, not instants: they are handled as UTC
// midnights so the grid never shifts a day with the viewer's time zone.
function keyToUtc(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

function utcToKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(key: string) {
  return `${key.slice(0, 7)}-01`;
}

function shiftMonth(firstOfMonth: string, months: number) {
  const date = keyToUtc(firstOfMonth);
  date.setUTCMonth(date.getUTCMonth() + months);
  return utcToKey(date);
}

/** The weeks of a month, starting on Monday (Vietnamese calendars). */
function monthGrid(firstOfMonth: string) {
  const first = keyToUtc(firstOfMonth);
  const offset = (first.getUTCDay() + 6) % 7;
  const nextMonth = keyToUtc(shiftMonth(firstOfMonth, 1)).getTime();
  const length =
    Math.ceil((offset + (nextMonth - first.getTime()) / 86_400_000) / 7) * 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - offset);
  return Array.from({ length }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return utcToKey(day);
  });
}

/**
 * A month calendar where several days can be picked (Bản đồ F: "free on any
 * of these days"). The native date input picks one day only, so this is
 * drawn by hand: press a day to add it, press it again to take it out.
 */
export function MultiDateCalendar({
  value,
  onChange,
  min,
  maxCount,
  label,
  className,
}: MultiDateCalendarProps) {
  const t = useTranslations("uiKit.multiDate");
  const labelId = React.useId();
  const [month, setMonth] = React.useState(() => monthStart(value[0] ?? min));
  const selected = new Set(value);
  const full = value.length >= maxCount;
  const [year, monthNumber] = month.split("-").map(Number);
  const inMonth = month.slice(0, 7);
  const canGoBack = month > monthStart(min);

  const toggle = (key: string) => {
    if (selected.has(key)) {
      onChange(value.filter((day) => day !== key));
    } else if (!full) {
      onChange([...value, key].sort());
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <span
          id={labelId}
          className="text-body-sm font-semibold! text-text-primary"
        >
          {label}
        </span>
      ) : null}
      <div className="rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={!canGoBack}
            aria-label={t("previousMonth")}
            className="focus-ring grid size-9 place-items-center rounded-full text-text-secondary hover:bg-bg-sunken hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span
            aria-live="polite"
            className="text-body-md font-semibold! text-text-primary"
          >
            {t("month", { month: monthNumber, year })}
          </span>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label={t("nextMonth")}
            className="focus-ring grid size-9 place-items-center rounded-full text-text-secondary hover:bg-bg-sunken hover:text-text-primary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div
          role="group"
          aria-labelledby={label ? labelId : undefined}
          className="grid grid-cols-7 gap-1 text-center"
        >
          {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map(
            (day) => (
              <span
                key={day}
                aria-hidden
                className="py-1 text-meta font-semibold text-text-tertiary"
              >
                {t(`weekday.${day}`)}
              </span>
            ),
          )}
          {monthGrid(month).map((key) => {
            const outside = key.slice(0, 7) !== inMonth;
            const past = key < min;
            const on = selected.has(key);
            const disabled = past || (full && !on);
            if (outside) return <span key={key} aria-hidden />;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                aria-label={t("day", {
                  date: `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`,
                })}
                disabled={disabled}
                onClick={() => toggle(key)}
                className={cn(
                  "focus-ring grid h-10 place-items-center rounded-full text-body-sm tabular-nums transition-colors duration-[var(--fg-dur-150)]",
                  on
                    ? "bg-brand-primary font-semibold! text-text-on-brand"
                    : "text-text-primary hover:bg-bg-sunken",
                  disabled &&
                    "pointer-events-none text-text-tertiary opacity-40",
                )}
              >
                {Number(key.slice(8, 10))}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-body-sm text-text-secondary">
        <span aria-live="polite">
          {value.length === 0
            ? t("none")
            : full
              ? t("full", { count: maxCount })
              : t("count", { count: value.length })}
        </span>
        {value.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="focus-ring rounded-[4px] font-semibold text-text-primary underline underline-offset-4"
          >
            {t("clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
