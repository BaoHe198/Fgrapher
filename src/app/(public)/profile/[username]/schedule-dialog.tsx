"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
// one week of days across the top, then the packages. A start time is the
// choice that matters, so picking one goes straight to the request form with
// package, day and time filled in; nothing is sent from here.
//
// Every package used to show its own grid of start times, one under the
// other: four packages times twenty start times was a very long scroll on a
// phone (role walk-through, 25/11/2026). Now each package is one row saying
// how many start times are free that day, and only the chosen one opens.
//
// A provider with one package, or none (a request priced in chat), gets the
// grid straight away: there is nothing to choose between.
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
  // The package whose start times are open. Until the visitor picks one it
  // is the package whose card they clicked, or the only package there is.
  const [pickedByHand, setPickedByHand] = useState<string | null>(null);
  const single = services.length <= 1;
  const picked =
    pickedByHand ?? focusServiceId ?? (single ? (services[0]?.id ?? "") : null);
  const close = (next: boolean) => {
    if (!next) setPickedByHand(null);
    onOpenChange(next);
  };

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
    close(false);
    router.push(`/booking/${providerId}?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
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
            <ul className={cn("flex flex-col", single ? "gap-7" : "gap-2")}>
              {rows.map((service, index) => {
                const key = service?.id ?? "";
                const isOpen = single || picked === key;
                const dayInfo = byService[key]?.find((d) => d.date === day);
                const slots = (dayInfo?.slots ?? []).map((slot) => ({
                  start: slot.time,
                  status: slot.available
                    ? ("available" as const)
                    : slot.tooSoon
                      ? ("soon" as const)
                      : ("booked" as const),
                  golden: sun ? isGoldenHourSlot(slot.time, sun) : false,
                }));
                const photo =
                  photos.length > 0 ? photos[index % photos.length] : null;
                const free = slots.filter(
                  (slot) => slot.status === "available",
                ).length;
                const heading = (
                  <>
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
                    <span className="flex min-w-0 flex-1 flex-col text-left">
                      <span className="line-clamp-2 text-body-md font-semibold! text-text-primary">
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
                    </span>
                  </>
                );
                return (
                  <li
                    key={key || "none"}
                    id={service ? `schedule-${service.id}` : undefined}
                    className={cn(
                      "flex scroll-mt-4 flex-col",
                      single
                        ? "gap-3"
                        : cn(
                            "rounded-[var(--fg-radius-lg)] border",
                            isOpen
                              ? "border-border-strong bg-bg-sunken"
                              : "border-border-subtle",
                          ),
                    )}
                  >
                    {single ? (
                      <div className="flex items-center gap-3">{heading}</div>
                    ) : (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`schedule-times-${key}`}
                        onClick={() => setPickedByHand(isOpen ? "" : key)}
                        className="focus-ring flex min-h-14 items-center gap-3 rounded-[var(--fg-radius-lg)] p-3"
                      >
                        {heading}
                        <span className="flex shrink-0 items-center gap-1.5 text-meta text-text-secondary">
                          {loading ? null : free > 0 ? (
                            <span className="tabular-nums">
                              {t("freeCount", { count: free })}
                            </span>
                          ) : (
                            <span className="text-text-tertiary">
                              {t("full")}
                            </span>
                          )}
                          <ChevronDown
                            aria-hidden
                            className={cn(
                              "size-4 transition-transform duration-[var(--fg-dur-150)]",
                              isOpen ? "rotate-180" : null,
                            )}
                          />
                        </span>
                      </button>
                    )}
                    {isOpen ? (
                      <div
                        id={`schedule-times-${key}`}
                        className={single ? undefined : "px-3 pb-3"}
                      >
                        <TimeSlotGrid
                          slots={slots}
                          selected={null}
                          onSelect={(time) => book(service?.id ?? null, time)}
                          timezoneLabel={t("timezone")}
                          loading={loading}
                          emptyMessage={t("noTimes")}
                        />
                      </div>
                    ) : null}
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
