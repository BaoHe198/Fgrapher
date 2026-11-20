"use client";

import {
  Ban,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AgendaCard } from "@/components/calendar/agenda-card";
import { EntrySheet } from "@/components/calendar/entry-sheet";
import { ItemSheet } from "@/components/calendar/item-sheet";
import { ResponsiveSheet } from "@/components/calendar/responsive-sheet";
import { MonthGrid } from "@/components/calendar/month-grid";
import { SyncSheet } from "@/components/calendar/sync-sheet";
import {
  type DaySummary,
  KIND_DOT,
  WeekStrip,
} from "@/components/calendar/week-strip";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { ListSkeleton } from "@/components/ui/skeleton";
import {
  type AgendaItem,
  addDays,
  agendaKey,
  clashingKeys,
  groupByDay,
  monthWindow,
  weekdayOf,
  weekOf,
} from "@/lib/calendar/agenda";
import { formatDateLong, formatMonthYear } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WeeklyRule } from "@/services/resource-calendar";

import { AvailabilitySettings } from "../settings/profile/availability-settings";

import { BlockDayDialog } from "./block-day-dialog";

interface CalendarClientProps {
  initialItems: AgendaItem[];
  /** The day to open on: today, or ?date= from a reminder's link. */
  initialDate: string;
  /** Vietnam's today, decided on the server so both renders agree. */
  todayKey: string;
  weeklySchedule: WeeklyRule[];
  /** ?hours=1: open on the working-hours panel (links from "Trang của tôi"). */
  openHours?: boolean;
}

type Panel =
  | { type: "hours" }
  | { type: "entry"; entry: AgendaItem | null }
  | { type: "item"; item: AgendaItem }
  | { type: "block" }
  | { type: "sync" }
  | null;

export function CalendarClient({
  initialItems,
  initialDate,
  todayKey,
  weeklySchedule: initialWeeklySchedule,
  openHours = false,
}: CalendarClientProps) {
  const t = useTranslations("dashboardCore.calendar");
  const v2 = useTranslations("dashboardCore.calendar.v2");

  const [selected, setSelected] = useState(initialDate);
  const [items, setItems] = useState(initialItems);
  const [loadedMonth, setLoadedMonth] = useState(initialDate.slice(0, 7));
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [panel, setPanel] = useState<Panel>(
    openHours ? { type: "hours" } : null,
  );
  const [weeklySchedule, setWeeklySchedule] = useState(initialWeeklySchedule);
  // After the hours are saved in the panel, read them back so the day's
  // "Giờ nhận khách" line and the closed-day shading follow at once.
  const reloadHours = useCallback(() => {
    fetch("/api/availability")
      .then((res) => res.json())
      .then((body) => {
        const schedule = body.data?.schedule as WeeklyRule[] | undefined;
        if (schedule) startTransition(() => setWeeklySchedule(schedule));
      })
      .catch(() => {});
  }, []);
  // Bumped to refetch the month that is already on screen (after a save).
  const [revision, setRevision] = useState(0);
  const lastRevision = useRef(0);

  const range = useMemo(() => monthWindow(selected), [selected]);
  const selectedMonth = selected.slice(0, 7);

  // Load a month when the chosen day leaves the one on screen, and again
  // whenever something in it was changed. The first month came with the page.
  useEffect(() => {
    const changed = revision !== lastRevision.current;
    if (selectedMonth === loadedMonth && !changed) return;
    lastRevision.current = revision;
    let cancelled = false;
    // Keep what is on screen while re-reading the same month; only a new
    // month shows the placeholder.
    if (selectedMonth !== loadedMonth) {
      startTransition(() => setStatus("loading"));
    }
    fetch(`/api/calendar?from=${range.from}&to=${range.to}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message);
        return body.data.items as AgendaItem[];
      })
      .then((next) => {
        if (cancelled) return;
        startTransition(() => {
          setItems(next);
          setLoadedMonth(selectedMonth);
          setStatus("idle");
        });
      })
      .catch(() => {
        if (!cancelled) startTransition(() => setStatus("error"));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, loadedMonth, revision, range.from, range.to]);

  const reload = useCallback(() => setRevision((n) => n + 1), []);

  const byDay = useMemo(() => groupByDay(items), [items]);
  const summaries = useMemo(() => {
    const map = new Map<string, DaySummary>();
    for (const [dateKey, dayItems] of byDay) {
      map.set(dateKey, {
        jobs: dayItems
          .filter((item) => item.kind !== "BLOCK")
          .map((item) => item.kind as "BOOKING" | "ENTRY"),
        blocked: dayItems.some((item) => item.kind === "BLOCK"),
      });
    }
    return map;
  }, [byDay]);

  const dayItems = useMemo(() => byDay.get(selected) ?? [], [byDay, selected]);
  const clashing = useMemo(() => clashingKeys(dayItems), [dayItems]);
  const dayJobs = dayItems.filter((item) => item.kind !== "BLOCK").length;
  const dayBlock = dayItems.find((item) => item.kind === "BLOCK") ?? null;

  const workingWeekdays = useMemo(
    () =>
      new Set(
        weeklySchedule
          .filter((rule) => rule.isActive)
          .map((rule) => rule.dayOfWeek),
      ),
    [weeklySchedule],
  );
  const dayHours = weeklySchedule
    .filter((rule) => rule.isActive && rule.dayOfWeek === weekdayOf(selected))
    .map((rule) => `${rule.startTime}–${rule.endTime}`)
    .join(", ");

  const describeDay = (dateKey: string, jobs: number) =>
    v2("dayWithJobs", { day: formatDateLong(dateKey), count: jobs });

  const openItem = (item: AgendaItem) =>
    setPanel(
      item.kind === "BLOCK" ? { type: "block" } : { type: "item", item },
    );

  const isLoadingMonth = status === "loading";

  return (
    <div className="flex flex-col gap-4 pb-40 xl:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPanel({ type: "hours" })}
            className="min-h-10"
          >
            <Clock className="size-4" />
            {v2("hoursButton")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPanel({ type: "sync" })}
            className="min-h-10"
          >
            <Bell className="size-4" />
            {v2("sync")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* A week at a time with the strip below, a month at a time beside
            the month grid. The grid appears from xl (1280px), not lg: inside
            the dashboard's sidebar layout a 1024px window leaves the grid
            about 350px, the same unreadable cells a phone would get. */}
        <button
          type="button"
          aria-label={v2("prevWeek")}
          onClick={() => setSelected((day) => addDays(day, -7))}
          className="focus-ring flex size-10 items-center justify-center rounded-full hover:bg-bg-sunken xl:hidden"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label={t("prevMonth")}
          onClick={() => setSelected((day) => shiftMonth(day, -1))}
          className="focus-ring hidden size-10 items-center justify-center rounded-full hover:bg-bg-sunken xl:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="min-w-0 flex-1 text-center text-heading-sm text-text-primary first-letter:uppercase xl:flex-none xl:px-2">
          {formatMonthYear(selected)}
        </span>
        <button
          type="button"
          aria-label={v2("nextWeek")}
          onClick={() => setSelected((day) => addDays(day, 7))}
          className="focus-ring flex size-10 items-center justify-center rounded-full hover:bg-bg-sunken xl:hidden"
        >
          <ChevronRight className="size-5" />
        </button>
        <button
          type="button"
          aria-label={t("nextMonth")}
          onClick={() => setSelected((day) => shiftMonth(day, 1))}
          className="focus-ring hidden size-10 items-center justify-center rounded-full hover:bg-bg-sunken xl:flex"
        >
          <ChevronRight className="size-5" />
        </button>
        <div className="flex items-center gap-2 xl:ml-auto">
          <DateField
            value={selected}
            onChange={(value) => value && setSelected(value)}
            aria-label={v2("jumpToDate")}
            className="hidden w-40 sm:block"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={selected === todayKey}
            onClick={() => setSelected(todayKey)}
            className="min-h-10"
          >
            {v2("today")}
          </Button>
        </div>
      </div>

      <div className="xl:hidden">
        <WeekStrip
          days={weekOf(selected)}
          selected={selected}
          todayKey={todayKey}
          summaries={summaries}
          onSelect={setSelected}
          onSwipe={(direction) =>
            setSelected((day) => addDays(day, direction * 7))
          }
          label={v2("weekStripLabel")}
          describeDay={describeDay}
        />
      </div>

      {workingWeekdays.size === 0 ? (
        <p className="rounded-[var(--fg-radius-md)] bg-warning-bg p-3 text-body-sm text-text-primary">
          {t("noScheduleWarning")}{" "}
          <button
            type="button"
            onClick={() => setPanel({ type: "hours" })}
            className="font-semibold! text-text-link hover:underline"
          >
            {v2("editHours")}
          </button>
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:items-start">
        <div className="hidden flex-col gap-3 xl:flex">
          {isLoadingMonth ? (
            <ListSkeleton />
          ) : (
            <MonthGrid
              monthOf={selected}
              from={range.from}
              to={range.to}
              selected={selected}
              todayKey={todayKey}
              byDay={byDay}
              workingWeekdays={workingWeekdays}
              onSelect={setSelected}
              describeDay={describeDay}
              labels={{
                allDayBusy: t("busyLabel"),
                customJob: v2("customJob"),
                more: (count) => t("moreCount", { count }),
              }}
            />
          )}
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
            {(["BOOKING", "ENTRY", "BLOCK"] as const).map((kind) => (
              <li key={kind} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", KIND_DOT[kind])}
                />
                {v2(`monthLegend.${kind}`)}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-3 rounded-[3px] bg-warning-bg ring-1 ring-border-subtle"
              />
              {v2("monthLegend.closed")}
            </li>
          </ul>
        </div>

        <section
          aria-labelledby="calendar-day-heading"
          className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:-mx-1 xl:overflow-x-hidden xl:overflow-y-auto xl:px-1"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="calendar-day-heading"
              className="text-heading-sm text-text-primary first-letter:uppercase"
            >
              {formatDateLong(selected)}
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-text-secondary">
              <span>{v2("jobCount", { count: dayJobs })}</span>
              <span className="flex items-center gap-1.5">
                <Clock aria-hidden className="size-4 text-text-tertiary" />
                {dayHours
                  ? v2("workingHours", { hours: dayHours })
                  : v2("noWorkingHours")}
              </span>
              <button
                type="button"
                onClick={() => setPanel({ type: "hours" })}
                // Padding without height: a text line's 22px is a poor
                // target for a thumb; this makes it 42px tall in place.
                className="focus-ring -my-2.5 rounded-[4px] py-2.5 font-semibold! text-text-link hover:underline"
              >
                {v2("editHours")}
              </button>
            </p>
          </div>

          {status === "error" ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-2 rounded-[var(--fg-radius-md)] bg-danger-bg p-4 text-body-sm text-danger"
            >
              {v2("loadFailed")}
              <Button variant="outline" size="sm" onClick={reload}>
                {v2("retry")}
              </Button>
            </div>
          ) : isLoadingMonth ? (
            <ListSkeleton />
          ) : dayItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[var(--fg-radius-lg)] border border-dashed border-border-default px-4 py-8 text-center">
              <CalendarDays aria-hidden className="size-8 text-text-tertiary" />
              <p className="text-body-md font-semibold! text-text-primary">
                {v2("emptyDay")}
              </p>
              <p className="text-body-sm text-text-secondary">
                {v2("emptyDayHint")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {dayItems.map((item) => (
                <li key={agendaKey(item)}>
                  <AgendaCard
                    item={item}
                    clashing={clashing.has(agendaKey(item))}
                    onOpen={openItem}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* Wraps: the two labels side by side need about 400px and the
              panel is 320-380, so in one row they overflowed it and, the
              panel being a scroll container, gave it a sideways scrollbar
              (owner's screenshot, 20/11/2026). On a phone "add" is the
              floating button below; this row keeps the quieter action
              within reach on both. */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              onClick={() => setPanel({ type: "entry", entry: null })}
              className="hidden min-h-11 flex-1 xl:inline-flex"
            >
              <Plus className="size-4" />
              {v2("addEntryLong")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPanel({ type: "block" })}
              className="min-h-11 flex-1"
            >
              <Ban className="size-4" />
              {dayBlock ? v2("editBusy") : v2("markBusy")}
            </Button>
          </div>
        </section>
      </div>

      {/* Sits a toast's height above the bottom edge: "Đã lưu vào lịch"
          appears there (full width on a phone) and, placed any lower, this
          button could not be pressed again until the toast had gone — which
          is exactly when someone entering a week of jobs wants it. */}
      <Button
        variant="accent"
        size="lg"
        onClick={() => setPanel({ type: "entry", entry: null })}
        className="fixed right-4 bottom-[calc(5rem+var(--fg-bottom-bar,0px))] z-30 min-h-14 rounded-full px-5 shadow-[var(--shadow-lg)] xl:hidden"
      >
        <Plus className="size-5" />
        {v2("addEntry")}
      </Button>

      {panel?.type === "entry" ? (
        <EntrySheet
          key={panel.entry?.id ?? `new-${selected}`}
          entry={panel.entry}
          defaultDate={selected}
          existing={items}
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
          onSaved={(dateKey) => {
            setPanel(null);
            setSelected(dateKey);
            reload();
          }}
        />
      ) : null}
      {panel?.type === "item" ? (
        <ItemSheet
          key={agendaKey(panel.item)}
          item={panel.item}
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
          onEdit={(entry) => setPanel({ type: "entry", entry })}
          onChanged={() => {
            setPanel(null);
            reload();
          }}
        />
      ) : null}
      {panel?.type === "hours" ? (
        <ResponsiveSheet
          open
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
          title={v2("hoursTitle")}
          description={v2("hoursDescription")}
        >
          <AvailabilitySettings embedded onSaved={reloadHours} />
        </ResponsiveSheet>
      ) : null}
      {panel?.type === "sync" ? (
        <SyncSheet
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
        />
      ) : null}
      <BlockDayDialog
        date={
          panel?.type === "block" ? new Date(`${selected}T00:00:00.000Z`) : null
        }
        existingBlock={
          dayBlock
            ? {
                id: dayBlock.id,
                date: dayBlock.dateKey,
                reason: dayBlock.notes,
                startTime: dayBlock.startTime,
                endTime: dayBlock.endTime,
              }
            : null
        }
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        onChanged={() => {
          setPanel(null);
          reload();
        }}
      />
    </div>
  );
}

/** The same day of the month before or after, clamped to that month's end. */
function shiftMonth(dateKey: string, delta: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
