"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { TimeSlotGrid } from "@/components/booking/time-slot-grid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FgImage } from "@/components/ui/fg-image";
import { formatWeekdayShort } from "@/lib/format";
import { isGoldenHourSlot, sunTimes } from "@/lib/sun";
import { cn, formatCurrency } from "@/lib/utils";
import { vietnamDateKey } from "@/lib/vietnam/date";
import type { DayAvailability } from "@/services/availability";

export interface ScheduleService {
  id: string;
  name: string;
  price: number;
  currency: string;
  editedPhotoCount?: number | null;
  deliveryDays?: number | null;
}

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  /** How the dialog addresses the provider: a first name, or a studio's name. */
  callName: string;
  services: ScheduleService[];
  /** A package to scroll to and mark when the dialog opens from its card. */
  focusServiceId: string | null;
  /** One photo per package row, by index; the provider's own work. */
  photos: string[];
  sunPoint: { latitude: number; longitude: number } | null;
}

const addDays = (dateKey: string, days: number) => {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// "Đặt lịch chụp" (Airbnb's "Schedule your photo shoot", owner 17/11/2026):
// one week of days across the top, then every package with its own grid of
// free start times for the chosen day. A start time is the choice that
// matters, so picking one goes straight to the request form with package,
// day and time filled in; nothing is sent from here.
//
// A provider with no packages gets one grid, for a request priced in chat.
export function ScheduleDialog({
  open,
  onOpenChange,
  providerId,
  callName,
  services,
  focusServiceId,
  photos,
  sunPoint,
}: ScheduleDialogProps) {
  const t = useTranslations("profilePage.schedule");
  const router = useRouter();
  const today = vietnamDateKey();
  const [weekStart, setWeekStart] = useState(today);
  const [day, setDay] = useState(today);
  // Availability per package (each package's length changes which start
  // times fit), keyed by service id; "" is the no-package grid.
  const [byService, setByService] = useState<Record<string, DayAvailability[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const rows = useMemo(
    () => (services.length > 0 ? services : [null]),
    [services],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setFailed(false);
    });
    Promise.all(
      rows.map((service) =>
        fetch(
          `/api/availability/${providerId}?from=${weekStart}${service ? `&serviceId=${service.id}` : ""}`,
        )
          .then((res) => {
            if (!res.ok) throw new Error(String(res.status));
            return res.json();
          })
          .then(
            (body) =>
              [
                service?.id ?? "",
                (body.data?.dates ?? []) as DayAvailability[],
              ] as const,
          ),
      ),
    )
      .then((entries) => {
        if (cancelled) return;
        // Open on the first day with a free start time, not on a day that
        // can only show "Đã đặt" (today usually, given the notice rule).
        const firstOpen = entries
          .flatMap(([, days]) => days)
          .filter((d) => d.slots.some((s) => s.available))
          .map((d) => d.date)
          .sort()[0];
        startTransition(() => {
          setByService(Object.fromEntries(entries));
          setLoading(false);
          if (firstOpen) setDay(firstOpen);
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
  }, [open, providerId, weekStart, rows]);

  // Bring the package the visitor clicked into view once its row exists.
  useEffect(() => {
    if (!open || !focusServiceId || loading) return;
    document
      .getElementById(`schedule-${focusServiceId}`)
      ?.scrollIntoView({ block: "start" });
  }, [open, focusServiceId, loading]);

  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const sun = sunPoint
    ? sunTimes(day, sunPoint.latitude, sunPoint.longitude)
    : null;
  // A day is worth offering when any package has a free start time on it.
  const dayHasRoom = (date: string) =>
    Object.values(byService).some((days) =>
      days.find((d) => d.date === date)?.slots.some((s) => s.available),
    );

  const changeWeek = (delta: -7 | 7) => {
    const next = addDays(weekStart, delta);
    setWeekStart(next);
    setDay(next < today ? today : next);
  };

  const book = (serviceId: string | null, time: string) => {
    const params = new URLSearchParams({ date: day, time });
    if (serviceId) params.set("service", serviceId);
    onOpenChange(false);
    router.push(`/booking/${providerId}?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="gap-1 px-6 pt-6 pb-4">
          <DialogTitle className="text-display-sm text-text-primary">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-body-sm text-text-secondary">
            {t("subtitle", { name: callName })}
          </DialogDescription>
        </DialogHeader>

        <div className="border-y border-border-subtle px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-body-md font-semibold! text-text-primary">
              {t("week", {
                from: `${week[0].slice(8)}/${week[0].slice(5, 7)}`,
                to: `${week[6].slice(8)}/${week[6].slice(5, 7)}`,
              })}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => changeWeek(-7)}
                disabled={weekStart <= today}
                aria-label={t("prevWeek")}
                className="focus-ring flex size-9 items-center justify-center rounded-full text-text-secondary hover:bg-bg-sunken disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => changeWeek(7)}
                aria-label={t("nextWeek")}
                className="focus-ring flex size-9 items-center justify-center rounded-full text-text-secondary hover:bg-bg-sunken"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div
            role="radiogroup"
            aria-label={t("dayLabel")}
            className="grid grid-cols-7 gap-1"
          >
            {week.map((date) => {
              const selected = date === day;
              const past = date < today;
              const room = !loading && dayHasRoom(date);
              return (
                <button
                  key={date}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={past}
                  onClick={() => setDay(date)}
                  className={cn(
                    "focus-ring flex flex-col items-center gap-0.5 rounded-full py-2 transition-colors duration-[var(--fg-dur-150)]",
                    selected
                      ? "bg-text-primary text-bg-page"
                      : past
                        ? "text-text-tertiary line-through opacity-50"
                        : "text-text-primary hover:bg-bg-sunken",
                  )}
                >
                  <span className="text-[11px] uppercase opacity-70">
                    {formatWeekdayShort(`${date}T00:00:00+07:00`)}
                  </span>
                  <span className="text-body-md font-semibold! tabular-nums">
                    {Number(date.slice(8))}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "size-1 rounded-full",
                      room && !selected ? "bg-gold-500" : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {failed ? (
            <p className="text-body-sm text-danger">{t("loadFailed")}</p>
          ) : (
            <ul className="flex flex-col gap-7">
              {rows.map((service, index) => {
                const key = service?.id ?? "";
                const dayInfo = byService[key]?.find((d) => d.date === day);
                const slots = (dayInfo?.slots ?? []).map((slot) => ({
                  start: slot.time,
                  status: slot.available
                    ? ("available" as const)
                    : ("booked" as const),
                  golden: sun ? isGoldenHourSlot(slot.time, sun) : false,
                }));
                const photo =
                  photos.length > 0 ? photos[index % photos.length] : null;
                return (
                  <li
                    key={key || "none"}
                    id={service ? `schedule-${service.id}` : undefined}
                    className={cn(
                      "flex scroll-mt-4 flex-col gap-3",
                      service && service.id === focusServiceId
                        ? "rounded-[var(--fg-radius-lg)] bg-bg-sunken p-3 -m-3"
                        : null,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {photo ? (
                        <FgImage
                          src={photo}
                          alt=""
                          ratio="1/1"
                          rounded="md"
                          reveal={false}
                          sizes="56px"
                          className="size-14 shrink-0"
                        />
                      ) : null}
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-body-md font-semibold! text-text-primary">
                          {service?.name ?? t("anyPackage")}
                        </span>
                        <span className="text-body-sm text-text-secondary">
                          {service
                            ? service.price > 0
                              ? t("price", {
                                  price: formatCurrency(
                                    service.price,
                                    service.currency,
                                  ),
                                })
                              : t("tfp")
                            : t("priceInChat", { name: callName })}
                        </span>
                      </div>
                    </div>
                    <TimeSlotGrid
                      slots={slots}
                      selected={null}
                      onSelect={(time) => book(service?.id ?? null, time)}
                      timezoneLabel={t("timezone")}
                      loading={loading}
                      emptyMessage={t("noTimes")}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="border-t border-border-subtle px-6 py-3 text-meta text-text-tertiary">
          {t("noCharge", { name: callName })}
        </p>
      </DialogContent>
    </Dialog>
  );
}
