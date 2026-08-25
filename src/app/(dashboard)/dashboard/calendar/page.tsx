"use client";

import type { Booking, BookingStatus, User } from "@prisma/client";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatMonthYear,
  formatWeekdayDayMonth,
  formatWeekdayShort,
} from "@/lib/format";
import { cn } from "@/lib/utils";

// 2024-01-07 (UTC) was a Sunday — used only to derive locale weekday
// abbreviations in Sun..Sat order for the calendar grid header, not tied
// to the actual displayed month.
const WEEKDAY_HEADERS = Array.from({ length: 7 }, (_, i) =>
  formatWeekdayShort(new Date(Date.UTC(2024, 0, 7 + i))),
);

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    startTransition(() => setIsLoading(true));
    fetch(`/api/bookings/calendar?month=${monthKey(monthCursor)}`)
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setBookings(body.data ?? []);
          setIsLoading(false);
        });
      });
  }, [monthCursor]);

  const byDate = new Map<string, BookingRow[]>();
  for (const booking of bookings) {
    const key = dateKey(new Date(booking.date));
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(booking);
  }

  const firstOfMonth = new Date(
    Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth(), 1),
  );
  const startWeekday = firstOfMonth.getUTCDay();
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

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : view === "MONTH" ? (
        <Card padding={false} className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border-subtle text-caption-upper tracking-[0.06em] text-text-tertiary">
            {WEEKDAY_HEADERS.map((d, i) => (
              <div key={i} className="px-2 py-2.5 text-center">
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
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[96px] border-b border-r border-border-subtle p-1.5",
                    key === todayKey && "bg-success-bg/40",
                  )}
                >
                  <span className="text-body-sm font-semibold text-text-primary">
                    {date.getUTCDate()}
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayBookings.slice(0, 3).map((b) => (
                      <Link
                        key={b.id}
                        href={`/dashboard/bookings/${b.id}`}
                        className="flex items-center gap-1 truncate rounded-[4px] bg-bg-sunken px-1 py-0.5 text-body-sm text-text-secondary hover:bg-bg-surface"
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
          {bookings.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-text-secondary">
              {t("emptyMonth")}
            </p>
          ) : (
            bookings.map((b) => (
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
            ))
          )}
        </Card>
      )}
    </div>
  );
}
