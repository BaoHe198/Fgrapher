"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { WEEKDAY_SHORT_LABELS_VI } from "@/lib/constants";
import { formatMonthYear, formatWeekdayShort } from "@/lib/format";
import { cn, mondayFirstColumn } from "@/lib/utils";
import { vietnamDateKey } from "@/lib/vietnam/date";

// The customer-facing month calendar (system audit 09/2026 §05), grown out
// of the booking wizard's grid; the profile's 7-day strip is the same
// component with compact="week".
//
// State rules (audit §02): the chosen day is always brand-primary; a full
// day ("Đã kín") is information, so it keeps readable text-tertiary with a
// strike-through and a dashed edge instead of fading; a day off reads
// "Nghỉ" on a sunken cell; only past days - truly locked - drop to .5.

export type CalendarDayStatus = "available" | "full" | "off" | "past";

export interface CalendarDay {
  /** "yyyy-MM-dd" */
  date: string;
  status: CalendarDayStatus;
}

interface AvailabilityCalendarProps {
  /** First day of the month on screen (ignored in compact mode). */
  month: Date;
  days: CalendarDay[];
  selected: string | null;
  onSelect: (date: string) => void;
  /** Month paging; omit to hide the arrows. */
  onMonthChange?: (delta: -1 | 1) => void;
  canGoBack?: boolean;
  loading?: boolean;
  /** Shown under the grid when no day in view is bookable. */
  emptyMessage?: React.ReactNode;
  /** "week" renders `days` as one row - the profile's 7-day strip. */
  compact?: "week";
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function AvailabilityCalendar({
  month,
  days,
  selected,
  onSelect,
  onMonthChange,
  canGoBack = true,
  loading = false,
  emptyMessage,
  compact,
  className,
}: AvailabilityCalendarProps) {
  const t = useTranslations("uiKit.availabilityCalendar");
  const byDate = React.useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days],
  );

  const cells = React.useMemo<(string | null)[]>(() => {
    if (compact === "week") return days.map((day) => day.date);
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: mondayFirstColumn(first.getDay()) }, () => null),
      ...Array.from(
        { length: count },
        (_, i) =>
          `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(i + 1)}`,
      ),
    ];
  }, [compact, days, month]);

  const today = vietnamDateKey();
  const hasAvailable = days.some((day) => day.status === "available");

  const statusLabel: Record<CalendarDayStatus, string> = {
    available: t("status.available"),
    full: t("status.full"),
    off: t("status.off"),
    past: t("status.past"),
  };

  return (
    <div
      data-slot="availability-calendar"
      className={cn("flex flex-col gap-3", className)}
    >
      {compact !== "week" ? (
        <div className="flex items-center justify-between">
          <span className="text-heading-sm text-text-primary">
            {formatMonthYear(month)}
          </span>
          {onMonthChange ? (
            <div className="flex gap-1">
              <button
                type="button"
                aria-label={t("previousMonth")}
                disabled={!canGoBack}
                onClick={() => onMonthChange(-1)}
                className="focus-ring flex size-9 items-center justify-center rounded-full text-text-secondary hover:bg-bg-sunken hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("nextMonth")}
                onClick={() => onMonthChange(1)}
                className="focus-ring flex size-9 items-center justify-center rounded-full text-text-secondary hover:bg-bg-sunken hover:text-text-primary"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {compact !== "week" ? (
        <div className="grid grid-cols-7 gap-1.5 text-center text-meta tracking-[0.12em] text-text-tertiary uppercase">
          {WEEKDAY_SHORT_LABELS_VI.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-7 gap-1.5" aria-busy="true">
          {Array.from({ length: compact === "week" ? 7 : 35 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((date, index) => {
            if (!date) return <span key={`blank-${index}`} aria-hidden />;
            const day = byDate.get(date);
            const status: CalendarDayStatus =
              day?.status ?? (date < today ? "past" : "off");
            const isSelected = date === selected;
            const selectable = status === "available";
            const dayNumber = Number(date.slice(8, 10));
            return (
              <button
                key={date}
                type="button"
                data-interactive="true"
                aria-pressed={isSelected}
                aria-disabled={!selectable || undefined}
                aria-label={`${date.split("-").reverse().join("/")}, ${statusLabel[status]}`}
                onClick={() => selectable && onSelect(date)}
                className={cn(
                  "focus-ring relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--fg-radius-sm)] border text-body-sm transition-colors duration-[var(--fg-dur-150)]",
                  compact === "week" && "h-16",
                  isSelected
                    ? "border-brand-primary bg-brand-primary text-text-on-brand"
                    : status === "available"
                      ? "cursor-pointer border-border-subtle bg-bg-surface text-text-primary hover:border-border-strong hover:bg-bg-sunken"
                      : status === "full"
                        ? "cursor-not-allowed border-dashed border-border-default bg-transparent text-text-tertiary"
                        : status === "off"
                          ? "cursor-not-allowed border-transparent bg-bg-sunken text-text-tertiary"
                          : "cursor-not-allowed border-transparent text-text-tertiary opacity-50",
                )}
              >
                {compact === "week" ? (
                  <span
                    className={cn(
                      "text-meta uppercase",
                      isSelected ? "text-text-on-brand" : "text-text-tertiary",
                    )}
                  >
                    {formatWeekdayShort(date)}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    status === "full" && !isSelected && "line-through",
                  )}
                >
                  {dayNumber}
                </span>
                {status === "available" && !isSelected ? (
                  <span
                    aria-hidden
                    className="size-1 rounded-full bg-brand-primary"
                  />
                ) : status === "off" ? (
                  <span aria-hidden className="text-[0.75rem] leading-none">
                    {t("offShort")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {!loading ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-brand-primary"
            />
            {t("legend.available")}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="line-through">
              12
            </span>
            {t("legend.full")}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="rounded-[4px] bg-bg-sunken px-1">
              {t("offShort")}
            </span>
            {t("legend.off")}
          </span>
        </div>
      ) : null}

      {!loading && !hasAvailable && emptyMessage ? (
        <p className="rounded-[var(--fg-radius-md)] bg-bg-sunken px-3.5 py-3 text-body-sm text-text-secondary">
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}

/** Maps the availability API's day shape onto calendar statuses. */
export function toCalendarDays(
  days: { date: string; busy: boolean; slots: { available: boolean }[] }[],
  today: string,
): CalendarDay[] {
  return days.map((day) => ({
    date: day.date,
    status:
      day.date < today
        ? "past"
        : day.busy || day.slots.length === 0
          ? "off"
          : day.slots.some((slot) => slot.available)
            ? "available"
            : "full",
  }));
}
