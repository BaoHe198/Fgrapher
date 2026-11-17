"use client";

import { CalendarOff, MessageCircle, Sunset } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import {
  AvailabilityCalendar,
  toCalendarDays,
} from "@/components/booking/availability-calendar";
import { TimeSlotGrid } from "@/components/booking/time-slot-grid";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { isGoldenHourSlot, minutesToTime, sunTimes } from "@/lib/sun";
import { cn, formatCurrency } from "@/lib/utils";
import { vietnamDateKey } from "@/lib/vietnam/date";
import type { DayAvailability } from "@/services/availability";

import type { LinkService } from "./link-packages";

interface LinkCalendarProps {
  providerId: string;
  callName: string;
  services: LinkService[];
  selectedServiceId: string | null;
  onServiceChange: (id: string) => void;
  date: string | null;
  time: string | null;
  onDateChange: (date: string | null) => void;
  onTimeChange: (time: string | null) => void;
  sunPoint: { latitude: number; longitude: number } | null;
  acceptingBookings: boolean;
  isOwnProfile: boolean;
  bookHref: string;
  /** Message link carrying the chosen package and day as the draft. */
  askHref: string;
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Step 4: the free days. A whole month at once (the profile sidebar only
// shows a week), because someone with a wedding or a graduation already has
// a date in mind and wants to know about that one. Same availability API
// and calendar component as the booking flow, so a day that is free here is
// free there; the chosen package, day and time carry into it.
export function LinkCalendar({
  providerId,
  callName,
  services,
  selectedServiceId,
  onServiceChange,
  date,
  time,
  onDateChange,
  onTimeChange,
  sunPoint,
  acceptingBookings,
  isOwnProfile,
  bookHref,
  askHref,
}: LinkCalendarProps) {
  const t = useTranslations("linkPage.calendar");
  const today = vietnamDateKey();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setFailed(false);
    });
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const serviceParam = selectedServiceId
      ? `&serviceId=${selectedServiceId}`
      : "";
    fetch(
      `/api/availability/${providerId}?from=${dateKey(month)}&to=${dateKey(last)}${serviceParam}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        startTransition(() => {
          setDays(body.data?.dates ?? []);
          setLoading(false);
        });
      })
      .catch(() => {
        if (cancelled) return;
        startTransition(() => {
          setFailed(true);
          setLoading(false);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, month, selectedServiceId]);

  const now = new Date();
  const atCurrentMonth =
    month.getFullYear() === now.getFullYear() &&
    month.getMonth() === now.getMonth();
  const calendarDays = useMemo(
    () => toCalendarDays(days, today),
    [days, today],
  );
  const freeCount = calendarDays.filter((d) => d.status === "available").length;
  const activeDay = days.find((d) => d.date === date);
  const sun = useMemo(
    () =>
      date && sunPoint
        ? sunTimes(date, sunPoint.latitude, sunPoint.longitude)
        : null,
    [date, sunPoint],
  );
  const slots = useMemo(
    () =>
      (activeDay?.slots ?? []).map((slot) => ({
        start: slot.time,
        status: slot.available ? ("available" as const) : ("booked" as const),
        golden: sun ? isGoldenHourSlot(slot.time, sun) : false,
      })),
    [activeDay, sun],
  );
  const selectedService = services.find((s) => s.id === selectedServiceId);
  const canAct = acceptingBookings && !isOwnProfile;

  return (
    <div className="flex flex-col gap-5">
      {services.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-meta font-semibold! tracking-[0.04em] text-text-secondary uppercase">
            {t("packageLegend")}
          </legend>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {services.map((service) => {
              const active = service.id === selectedServiceId;
              return (
                <button
                  key={service.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onServiceChange(service.id)}
                  className={cn(
                    "focus-ring inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-body-sm whitespace-nowrap transition-colors",
                    active
                      ? "border-gold-600 bg-gold-50 font-semibold! text-text-primary dark:border-gold-400 dark:bg-gold-900/30"
                      : "border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary",
                  )}
                >
                  {service.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {!acceptingBookings ? (
        <div className="flex items-start gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-sunken p-4">
          <CalendarOff
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-text-tertiary"
          />
          <p className="text-body-sm text-text-secondary">
            {t("pausedBody", { name: callName })}
          </p>
        </div>
      ) : null}

      <div className="rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-4 sm:p-5">
        <AvailabilityCalendar
          month={month}
          days={calendarDays}
          selected={date}
          loading={loading}
          canGoBack={!atCurrentMonth}
          onMonthChange={(delta) => {
            onDateChange(null);
            onTimeChange(null);
            setMonth(
              (prev) =>
                new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
            );
          }}
          onSelect={(next) => {
            onDateChange(next);
            onTimeChange(null);
          }}
          emptyMessage={
            failed ? t("loadFailed") : t("noFreeDays", { name: callName })
          }
        />
        {!loading && !failed && freeCount > 0 ? (
          <p className="mt-3 text-meta text-text-tertiary">
            {t("freeCount", { count: freeCount })}
          </p>
        ) : null}
      </div>

      {date ? (
        <div className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-heading-sm text-text-primary">
              {t("timesFor", { date: formatDate(`${date}T00:00:00+07:00`) })}
            </h3>
            {sun ? (
              <span className="inline-flex items-center gap-1.5 text-meta text-text-secondary">
                <Sunset aria-hidden className="size-3.5 text-gold-600" />
                {t("golden", {
                  sunrise: minutesToTime(sun.sunrise),
                  sunset: minutesToTime(sun.sunset),
                })}
              </span>
            ) : null}
          </div>
          <TimeSlotGrid
            slots={slots}
            selected={time}
            onSelect={onTimeChange}
            timezoneLabel={t("timezone")}
            loading={loading}
            emptyMessage={t("noTimes")}
          />
        </div>
      ) : null}

      {isOwnProfile ? (
        <p className="text-body-sm text-text-secondary">
          {t.rich("ownNote", {
            link: (chunks) => (
              <Link
                href="/dashboard/calendar"
                className="font-semibold! text-text-primary underline underline-offset-4"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : canAct ? (
        <div className="flex flex-col gap-3">
          {date ? (
            <div className="flex flex-col gap-1 rounded-[var(--fg-radius-md)] bg-bg-sunken px-4 py-3">
              <span className="text-body-sm font-semibold! text-text-primary">
                {[
                  selectedService?.name,
                  formatDate(`${date}T00:00:00+07:00`),
                  time,
                  selectedService && selectedService.price > 0
                    ? t("from", {
                        price: formatCurrency(
                          selectedService.price,
                          selectedService.currency,
                        ),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="text-meta text-text-tertiary">
                {t("noChargeYet")}
              </span>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            {date && time ? (
              <Button
                variant="accent"
                size="lg"
                className="sm:flex-1"
                nativeButton={false}
                render={<Link href={bookHref} />}
              >
                {t("sendRequest")}
              </Button>
            ) : (
              <Button variant="accent" size="lg" className="sm:flex-1" disabled>
                {t("sendRequest")}
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="sm:flex-1"
              nativeButton={false}
              render={<Link href={askHref} />}
            >
              <MessageCircle className="size-4" />
              {date ? t("askAboutDay") : t("askAboutDates")}
            </Button>
          </div>
          {!date || !time ? (
            <p className="text-meta text-text-tertiary">
              {date ? t("pickTimeHint") : t("pickDayHint")}
            </p>
          ) : null}
        </div>
      ) : (
        <Button
          variant="outline"
          size="lg"
          nativeButton={false}
          render={<Link href={askHref} />}
        >
          <MessageCircle className="size-4" />
          {t("askAboutDates")}
        </Button>
      )}
    </div>
  );
}
