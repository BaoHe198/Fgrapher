"use client";

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { useMessaging } from "@/components/providers/messaging-provider";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { formatMonthYear, formatWeekdayShort } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { DayAvailability } from "@/services/availability";

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: number;
}

interface BookingSidebarProps {
  providerId: string;
  firstName: string;
  services: ServiceOption[];
  selectedServiceId: string | null;
  onServiceChange: (id: string) => void;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// A "YYYY-MM-DD" calendar-date key built from LOCAL date parts — never
// toISOString() here, which reports the UTC calendar date and silently
// shifts by a day for anyone west-of-UTC-midnight in their local time
// (this app's Vietnamese audience is UTC+7).
function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function BookingSidebar({
  providerId,
  firstName,
  services,
  selectedServiceId,
  onServiceChange,
}: BookingSidebarProps) {
  const t = useTranslations("publicPages.profile.bookingSidebar");
  const router = useRouter();
  const messaging = useMessaging();
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const serviceParam = selectedServiceId
      ? `&serviceId=${selectedServiceId}`
      : "";
    fetch(
      `/api/availability/${providerId}?from=${toLocalDateKey(weekStart)}${serviceParam}`,
    )
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) {
          startTransition(() => {
            setDays(body.data?.dates ?? []);
            setIsLoading(false);
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, weekStart, selectedServiceId]);

  const changeWeek = (deltaDays: number) => {
    setIsLoading(true);
    setSelectedDate(null);
    setSelectedTime(null);
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const activeDay = days.find((d) => d.date === selectedDate);
  const today = toLocalDateKey(new Date());
  const minPrice =
    services.length > 0 ? Math.min(...services.map((s) => s.price)) : null;

  const onBookNow = () => {
    const params = new URLSearchParams();
    if (selectedServiceId) params.set("service", selectedServiceId);
    if (selectedDate) params.set("date", selectedDate);
    if (selectedTime) params.set("time", selectedTime);
    router.push(`/booking/${providerId}?${params.toString()}`);
  };

  // Opens the floating chat popup with this provider in-place, instead of
  // navigating to /dashboard/messages — a full navigation would lose
  // whatever service/date/time the customer already picked above, which
  // defeats the point of messaging to sort out details *before* booking.
  const onMessage = async () => {
    setIsOpeningChat(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: providerId }),
      });
      const body = await res.json();
      if (res.ok && body.data?.id) {
        messaging.open(body.data.id);
      }
    } finally {
      setIsOpeningChat(false);
    }
  };

  return (
    <div className="sticky top-[104px] flex flex-col gap-4 rounded-[var(--fg-radius-lg)] bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <div className="flex flex-col gap-1">
        <h3 className="text-heading-lg text-text-primary">
          {t("book", { name: firstName })}
        </h3>
        {minPrice !== null ? (
          <p className="text-body-md text-text-secondary">
            {t("from", {
              price: formatCurrency(minPrice, services[0]?.currency),
            })}
          </p>
        ) : null}
      </div>

      {services.length > 0 ? (
        <NativeSelect
          value={selectedServiceId ?? ""}
          onChange={onServiceChange}
          options={[
            { value: "", label: t("selectService") },
            ...services.map((s) => ({
              value: s.id,
              label: `${s.name} — ${formatCurrency(s.price, s.currency)}`,
            })),
          ]}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("selectDate")}
        </span>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => changeWeek(-7)}
            aria-label={t("prevWeek")}
            className="flex size-7 items-center justify-center rounded-full hover:bg-bg-sunken"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-body-sm font-semibold! text-text-primary">
            {formatMonthYear(weekStart)}
          </span>
          <button
            type="button"
            onClick={() => changeWeek(7)}
            aria-label={t("nextWeek")}
            className="flex size-7 items-center justify-center rounded-full hover:bg-bg-sunken"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-text-tertiary" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day) => {
              const date = new Date(day.date);
              const isSelected = day.date === selectedDate;
              const isToday = day.date === today;
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={day.busy}
                  onClick={() => {
                    setSelectedDate(day.date);
                    setSelectedTime(null);
                  }}
                  className={`flex flex-col items-center gap-1 rounded-[var(--fg-radius-sm)] py-2 ${
                    isSelected
                      ? "bg-brand-primary text-text-on-brand"
                      : day.busy
                        ? "cursor-not-allowed text-text-tertiary opacity-40"
                        : `cursor-pointer hover:bg-bg-sunken ${isToday ? "border border-brand-primary" : ""}`
                  }`}
                >
                  <span className="text-body-sm text-text-tertiary">
                    {formatWeekdayShort(date)}
                  </span>
                  <span className="text-body-md font-semibold!">
                    {date.getUTCDate()}
                  </span>
                  {day.busy ? (
                    <span className="size-1 rounded-full bg-text-tertiary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {activeDay && !activeDay.busy ? (
        <div className="flex flex-col gap-2">
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            {t("availableTimes")}
          </span>
          {activeDay.slots.filter((s) => s.available).length === 0 ? (
            <p className="text-body-sm text-text-secondary">{t("noTimes")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {activeDay.slots
                .filter((s) => s.available)
                .map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => setSelectedTime(slot.time)}
                    className={`rounded-[var(--fg-radius-sm)] border py-2.5 text-body-md font-semibold ${
                      selectedTime === slot.time
                        ? "border-transparent bg-brand-primary text-text-on-brand"
                        : "border-border-default bg-bg-surface text-text-primary"
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : null}

      {selectedDate && selectedTime ? (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          {selectedService ? (
            <div className="flex justify-between text-body-sm">
              <span className="text-text-tertiary">{t("service")}</span>
              <span className="text-text-primary">{selectedService.name}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-body-sm">
            <span className="text-text-tertiary">{t("date")}</span>
            <span className="text-text-primary">{selectedDate}</span>
          </div>
          <div className="flex justify-between text-body-sm">
            <span className="text-text-tertiary">{t("time")}</span>
            <span className="text-text-primary">{selectedTime}</span>
          </div>
          {selectedService ? (
            <div className="flex justify-between text-heading-sm font-bold!">
              <span>{t("total")}</span>
              <span>
                {formatCurrency(
                  selectedService.price,
                  selectedService.currency,
                )}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        disabled={!selectedDate || !selectedTime}
        onClick={onBookNow}
      >
        {t("bookNow")}
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        disabled={isOpeningChat}
        onClick={onMessage}
      >
        {isOpeningChat ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MessageCircle className="size-4" />
        )}
        {t("message", { name: firstName })}
      </Button>

      <div className="flex flex-col gap-2 text-body-sm text-text-secondary">
        <span>{t("cancellationNote")}</span>
        <span>{t("responseNote")}</span>
      </div>
    </div>
  );
}
