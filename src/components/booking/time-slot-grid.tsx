"use client";

import * as React from "react";
import { SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// 24-hour slots split into Sáng / Chiều / Tối, with the time zone named and
// golden-hour hints (system audit 09/2026 §05/§06). A booked slot stays on
// screen struck through - it tells the customer the provider is in demand -
// and a slot someone else took while this customer was deciding is drawn
// as an error, not silently removed.

export type TimeSlotStatus = "available" | "booked" | "taken";

export interface TimeSlot {
  /** "HH:mm", Vietnam time. */
  start: string;
  end?: string;
  status: TimeSlotStatus;
  golden?: boolean;
}

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selected: string | null;
  onSelect: (start: string) => void;
  /** e.g. "Giờ Việt Nam (GMT+7)". */
  timezoneLabel: string;
  loading?: boolean;
  emptyMessage?: React.ReactNode;
  className?: string;
}

type Period = "morning" | "afternoon" | "evening";

function periodOf(start: string): Period {
  const hour = Number(start.slice(0, 2));
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function TimeSlotGrid({
  slots,
  selected,
  onSelect,
  timezoneLabel,
  loading = false,
  emptyMessage,
  className,
}: TimeSlotGridProps) {
  const t = useTranslations("uiKit.timeSlotGrid");
  const groups = React.useMemo(() => {
    const map = new Map<Period, TimeSlot[]>();
    for (const slot of slots) {
      const period = periodOf(slot.start);
      map.set(period, [...(map.get(period) ?? []), slot]);
    }
    return (["morning", "afternoon", "evening"] as const)
      .map((period) => ({ period, slots: map.get(period) ?? [] }))
      .filter((group) => group.slots.length > 0);
  }, [slots]);

  const anyGolden = slots.some((slot) => slot.golden);
  const anyAvailable = slots.some((slot) => slot.status === "available");

  return (
    <div
      data-slot="time-slot-grid"
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-meta text-text-tertiary">{timezoneLabel}</span>
        {anyGolden ? (
          <span className="flex items-center gap-1.5 text-meta text-gold-700 dark:text-gold-400">
            <SunIcon aria-hidden className="size-3.5" />
            {t("goldenLegend")}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !anyAvailable ? (
        <p className="rounded-[var(--fg-radius-md)] border border-dashed border-border-strong px-3.5 py-3 text-body-sm text-text-secondary">
          {emptyMessage ?? t("empty")}
        </p>
      ) : null}

      {!loading
        ? groups.map((group) => (
            <div key={group.period} className="flex flex-col gap-2">
              <span className="text-body-sm font-semibold text-text-secondary">
                {t(`period.${group.period}`)}
              </span>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.slots.map((slot) => {
                  const isSelected = slot.start === selected;
                  const selectable = slot.status === "available";
                  const note =
                    slot.status === "booked"
                      ? t("booked")
                      : slot.status === "taken"
                        ? t("taken")
                        : slot.golden
                          ? t("golden")
                          : null;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      data-interactive="true"
                      aria-pressed={isSelected}
                      aria-disabled={!selectable || undefined}
                      aria-label={[slot.start, note].filter(Boolean).join(", ")}
                      onClick={() => selectable && onSelect(slot.start)}
                      className={cn(
                        "focus-ring flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--fg-radius-md)] border px-2 py-2 transition-colors duration-[var(--fg-dur-150)]",
                        isSelected
                          ? "border-brand-primary bg-brand-primary text-text-on-brand"
                          : slot.status === "available"
                            ? cn(
                                "cursor-pointer bg-bg-surface text-text-primary hover:border-border-strong hover:bg-bg-sunken",
                                slot.golden
                                  ? "border-gold-400"
                                  : "border-border-subtle",
                              )
                            : slot.status === "booked"
                              ? "cursor-not-allowed border-dashed border-border-default text-text-tertiary"
                              : "cursor-not-allowed border-dashed border-danger bg-danger-bg text-danger",
                      )}
                    >
                      <span
                        className={cn(
                          "text-body-sm font-semibold! tabular-nums",
                          slot.status === "booked" && "line-through",
                        )}
                      >
                        {slot.start}
                      </span>
                      {note ? (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[0.75rem] leading-none",
                            isSelected
                              ? "text-text-on-brand"
                              : slot.status === "available" && slot.golden
                                ? "text-gold-700 dark:text-gold-400"
                                : undefined,
                          )}
                        >
                          {slot.golden && slot.status === "available" ? (
                            <SunIcon aria-hidden className="size-3" />
                          ) : null}
                          {note}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}
