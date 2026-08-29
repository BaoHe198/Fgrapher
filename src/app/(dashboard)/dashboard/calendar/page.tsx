"use client";

import type { Booking, BookingStatus, User } from "@prisma/client";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WEEKDAY_SHORT_LABELS_VI } from "@/lib/constants";
import { formatMonthYear, formatWeekdayDayMonth } from "@/lib/format";
import { cn, mondayFirstColumn } from "@/lib/utils";

import { BlockDayDialog, type BlockedDateRow } from "./block-day-dialog";

type BookingParty = Pick<User, "firstName" | "name">;
type BookingRow = Booking & {
  customer: BookingParty;
  provider: BookingParty;
  service: { name: string } | null;
};

const STATUS_DOT: Record<BookingStatus, string> = {
  PENDING: "bg-warning",
  CONFIRMED: "bg-success",
  COMPLETED: "bg-text-tertiary",
  CANCELLED: "bg-danger",
  DECLINED: "bg-danger",
  NO_SHOW: "bg-danger",
  EXPIRED: "bg-text-tertiary",
};

const STATUS_BADGE_VARIANT: Record<
  BookingStatus,
  "warning" | "success" | "neutral" | "destructive"
> = {
  PENDING: "warning",
  CONFIRMED: "success",
  COMPLETED: "neutral",
  CANCELLED: "destructive",
  DECLINED: "destructive",
  NO_SHOW: "destructive",
  EXPIRED: "neutral",
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const t = useTranslations("dashboardCore.calendar");
  const tBookings = useTranslations("dashboardCore.bookings");

  function partyName(party: BookingParty) {
    return party.firstName ?? party.name ?? tBookings("unknownParty");
  }

  const [view, setView] = useState<"MONTH" | "AGENDA">("MONTH");
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogDate, setDialogDate] = useState<Date | null>(null);

  const load = useCallback(() => {
    startTransition(() => setIsLoading(true));
    const from = new Date(
      Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth(), 1),
    );
    const to = new Date(
      Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 1),
    );
    Promise.all([
      fetch(`/api/bookings/calendar?month=${monthKey(monthCursor)}`).then(
        (res) => res.json(),
      ),
      fetch(`/api/blocked-dates?from=${dateKey(from)}&to=${dateKey(to)}`).then(
        (res) => res.json(),
      ),
    ]).then(([bookingsBody, blockedBody]) => {
      startTransition(() => {
        setBookings(bookingsBody.data ?? []);
        setBlockedDates(blockedBody.data ?? []);
        setIsLoading(false);
      });
    });
  }, [monthCursor]);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = new Map<string, BookingRow[]>();
  for (const booking of bookings) {
    const key = dateKey(new Date(booking.date));
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(booking);
  }

  const blockedByDate = new Map<string, BlockedDateRow>();
  for (const b of blockedDates) {
    blockedByDate.set(dateKey(new Date(b.date)), {
      ...b,
      date: dateKey(new Date(b.date)),
    });
  }

  const firstOfMonth = new Date(
    Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth(), 1),
  );
  const startWeekday = mondayFirstColumn(firstOfMonth.getUTCDay());
  const daysInMonth = new Date(
    Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 0),
  ).getUTCDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) =>
        new Date(
          Date.UTC(
            monthCursor.getUTCFullYear(),
            monthCursor.getUTCMonth(),
            i + 1,
          ),
        ),
    ),
  ];

  const todayKey = dateKey(new Date());

  const changeMonth = (delta: number) => {
    setMonthCursor(
      (prev) =>
        new Date(
          Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + delta, 1),
        ),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display-md text-text-primary">{t("title")}</h1>
        <div className="inline-flex overflow-hidden rounded-full border border-border-subtle">
          {(["MONTH", "AGENDA"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-4 py-1.5 text-body-sm font-semibold",
                view === v
                  ? "bg-brand-primary text-text-on-brand"
                  : "text-text-secondary",
              )}
            >
              {v === "MONTH" ? t("monthView") : t("agendaView")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t("prevMonth")}
          onClick={() => changeMonth(-1)}
          className="flex size-8 items-center justify-center rounded-full hover:bg-bg-sunken"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-heading-sm text-text-primary">
          {formatMonthYear(monthCursor)}
        </span>
        <button
          type="button"
          aria-label={t("nextMonth")}
          onClick={() => changeMonth(1)}
          className="flex size-8 items-center justify-center rounded-full hover:bg-bg-sunken"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-body-sm text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          {t("legend.booked")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-text-tertiary" />
          {t("legend.blocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full border border-border-default" />
          {t("legend.open")}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : view === "MONTH" ? (
        <Card padding={false} className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border-subtle text-caption-upper tracking-[0.06em] text-text-tertiary">
            {WEEKDAY_SHORT_LABELS_VI.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date, i) => {
              if (!date)
                return (
                  <div
                    key={`empty-${i}`}
                    className="min-h-[96px] border-b border-r border-border-subtle"
                  />
                );
              const key = dateKey(date);
              const dayBookings = byDate.get(key) ?? [];
              const blocked = blockedByDate.get(key);
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDialogDate(date)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDialogDate(date);
                    }
                  }}
                  className={cn(
                    "min-h-[96px] cursor-pointer border-b border-r border-border-subtle p-1.5 hover:bg-bg-sunken",
                    key === todayKey && "bg-success-bg/40",
                    blocked && "bg-bg-sunken",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-body-sm font-semibold text-text-primary">
                      {date.getUTCDate()}
                    </span>
                    {blocked ? (
                      <span className="rounded-full bg-text-tertiary px-1.5 py-0.5 text-sm font-bold text-text-on-brand">
                        {t("busyLabel")}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayBookings.slice(0, 3).map((b) => (
                      <Link
                        key={b.id}
                        href={`/dashboard/bookings/${b.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 truncate rounded-[4px] bg-bg-surface px-1 py-0.5 text-body-sm text-text-secondary hover:bg-bg-sunken"
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            STATUS_DOT[b.status],
                          )}
                        />
                        <span className="truncate">
                          {b.startTime} {partyName(b.customer)}
                        </span>
                      </Link>
                    ))}
                    {dayBookings.length > 3 ? (
                      <span className="text-body-sm text-text-tertiary">
                        {t("moreCount", { count: dayBookings.length - 3 })}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          {bookings.length === 0 && blockedDates.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-text-secondary">
              {t("emptyMonth")}
            </p>
          ) : (
            <>
              {blockedDates.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    setDialogDate(new Date(`${b.date}T00:00:00.000Z`))
                  }
                  className="flex w-full items-center justify-between border-b border-border-subtle px-5 py-3.5 text-left last:border-b-0 hover:bg-bg-sunken"
                >
                  <div className="flex flex-col">
                    <span className="text-body-md font-semibold text-text-primary">
                      {t("busyLabel")}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </span>
                    <span className="text-body-sm text-text-secondary">
                      {formatWeekdayDayMonth(b.date)}
                      {b.startTime && b.endTime
                        ? ` · ${b.startTime}–${b.endTime}`
                        : ""}
                    </span>
                  </div>
                  <Badge variant="neutral">{t("legend.blocked")}</Badge>
                </button>
              ))}
              {bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/dashboard/bookings/${b.id}`}
                  className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5 last:border-b-0 hover:bg-bg-sunken"
                >
                  <div className="flex flex-col">
                    <span className="text-body-md font-semibold text-text-primary">
                      {partyName(b.customer)} ·{" "}
                      {b.service?.name ?? t("customRequest")}
                    </span>
                    <span className="text-body-sm text-text-secondary">
                      {formatWeekdayDayMonth(b.date)} · {b.startTime}
                    </span>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANT[b.status]}>
                    {tBookings(`status.${b.status}`)}
                  </Badge>
                </Link>
              ))}
            </>
          )}
        </Card>
      )}

      <BlockDayDialog
        date={dialogDate}
        existingBlock={
          dialogDate ? (blockedByDate.get(dateKey(dialogDate)) ?? null) : null
        }
        onOpenChange={(open) => {
          if (!open) setDialogDate(null);
        }}
        onChanged={load}
      />
    </div>
  );
}
