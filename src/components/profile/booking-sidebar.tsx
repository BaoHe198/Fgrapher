"use client";

import {
  CalendarCog,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import {
  AvailabilityCalendar,
  toCalendarDays,
} from "@/components/booking/availability-calendar";
import { TimeSlotGrid } from "@/components/booking/time-slot-grid";
import { AvailabilityDialog } from "@/components/profile/availability-dialog";
import { Button } from "@/components/ui/button";
import { ChoiceCard, ChoiceCardGroup } from "@/components/ui/choice-card";
import { formatDate } from "@/lib/format";
import { isGoldenHourSlot, sunTimes } from "@/lib/sun";
import { formatCurrency } from "@/lib/utils";
import { vietnamDateKey } from "@/lib/vietnam/date";
import type { DayAvailability } from "@/services/availability";

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: number;
  editedPhotoCount?: number | null;
  deliveryDays?: number | null;
}

interface BookingSidebarProps {
  providerId: string;
  firstName: string;
  services: ServiceOption[];
  selectedServiceId: string | null;
  onServiceChange: (id: string) => void;
  // The viewer is this profile's own owner — booking/messaging yourself
  // makes no sense (createBooking/getOrCreateConversation already reject
  // it server-side), so this renders a pointer to the dashboard instead
  // of a booking form that can only ever end in an error.
  isOwnProfile: boolean;
  priceLabel: string | null;
  rating: number | null;
  reviewCount: number;
  onMessage: () => void;
  isOpeningChat: boolean;
  /** Rough (~10 km) coordinates for golden-hour hints; never the address. */
  sunPoint?: { latitude: number; longitude: number } | null;
}

const addDays = (dateKey: string, days: number) => {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// The profile's booking column (redesign 09/2026): price and rating, the
// packages as choice cards, this week's free days, start times with
// golden-hour hints, a one-line summary, then "Gửi yêu cầu đặt lịch" -
// which opens the booking flow with everything picked here carried over.
export function BookingSidebar({
  providerId,
  firstName,
  services,
  selectedServiceId,
  onServiceChange,
  isOwnProfile,
  priceLabel,
  rating,
  reviewCount,
  onMessage,
  isOpeningChat,
  sunPoint,
}: BookingSidebarProps) {
  const t = useTranslations("publicPages.profile.bookingSidebar");
  const router = useRouter();
  const today = vietnamDateKey();
  const [weekStart, setWeekStart] = useState(today);
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  useEffect(() => {
    if (isOwnProfile) return;
    let cancelled = false;
    const serviceParam = selectedServiceId
      ? `&serviceId=${selectedServiceId}`
      : "";
    fetch(`/api/availability/${providerId}?from=${weekStart}${serviceParam}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) {
          startTransition(() => {
            setDays((body.data?.dates ?? []).slice(0, 7));
            setIsLoading(false);
          });
        }
      })
      .catch(() => {
        if (!cancelled) startTransition(() => setIsLoading(false));
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, weekStart, selectedServiceId, isOwnProfile]);

  const changeWeek = (delta: -7 | 7) => {
    setIsLoading(true);
    setSelectedDate(null);
    setSelectedTime(null);
    setWeekStart((prev) => addDays(prev, delta));
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const activeDay = days.find((d) => d.date === selectedDate);

  const slots = useMemo(() => {
    if (!activeDay || !selectedDate) return [];
    const sun = sunPoint
      ? sunTimes(selectedDate, sunPoint.latitude, sunPoint.longitude)
      : null;
    return activeDay.slots.map((slot) => ({
      start: slot.time,
      status: slot.available ? ("available" as const) : ("booked" as const),
      golden: sun ? isGoldenHourSlot(slot.time, sun) : false,
    }));
  }, [activeDay, selectedDate, sunPoint]);

  const onBookNow = () => {
    const params = new URLSearchParams();
    if (selectedServiceId) params.set("service", selectedServiceId);
    if (selectedDate) params.set("date", selectedDate);
    if (selectedTime) params.set("time", selectedTime);
    router.push(`/booking/${providerId}?${params.toString()}`);
  };

  if (isOwnProfile) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-surface p-6 shadow-[var(--shadow-sm)]">
        <CalendarCog className="size-6 text-text-tertiary" />
        <h3 className="text-heading-lg text-text-primary">
          {t("ownProfileTitle")}
        </h3>
        <p className="text-body-sm text-text-secondary">
          {t("ownProfileBody")}
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setAvailabilityOpen(true)}
        >
          {t("manageAvailability")}
        </Button>
        <AvailabilityDialog
          open={availabilityOpen}
          onOpenChange={setAvailabilityOpen}
        />
      </div>
    );
  }

  const sectionLabel =
    "text-meta tracking-[0.12em] text-text-tertiary uppercase";
  const summary = [
    selectedService?.name,
    selectedDate ? formatDate(`${selectedDate}T00:00:00+07:00`) : null,
    selectedTime,
    selectedService
      ? t("from", {
          price: formatCurrency(
            selectedService.price,
            selectedService.currency,
          ),
        })
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5 rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-surface p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-heading-md font-semibold! tabular-nums text-text-primary">
          {priceLabel ?? t("book", { name: firstName })}
        </span>
        {rating !== null ? (
          <span className="flex shrink-0 items-center gap-1 text-meta text-text-secondary">
            <Star
              aria-hidden
              className="size-3.5 fill-gold-400 text-gold-400"
            />
            {rating.toFixed(1).replace(".", ",")}
            {" · "}
            {t("reviewCount", { count: reviewCount })}
          </span>
        ) : null}
      </div>

      {services.length > 0 ? (
        <ChoiceCardGroup legend={t("packagesLabel")} className="gap-2">
          {services.map((service) => (
            <ChoiceCard
              key={service.id}
              name="sidebar-service"
              value={service.id}
              selected={service.id === selectedServiceId}
              onSelect={onServiceChange}
              title={service.name}
              meta={
                service.editedPhotoCount != null
                  ? t("editedPhotos", { count: service.editedPhotoCount })
                  : undefined
              }
              price={formatCurrency(service.price, service.currency)}
              size="sm"
            />
          ))}
        </ChoiceCardGroup>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>
            {weekStart === today
              ? t("thisWeek")
              : t("weekOf", {
                  date: formatDate(`${weekStart}T00:00:00+07:00`),
                })}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => changeWeek(-7)}
              disabled={weekStart <= today}
              aria-label={t("prevWeek")}
              className="focus-ring flex size-7 items-center justify-center rounded-full text-text-secondary hover:bg-bg-sunken disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => changeWeek(7)}
              aria-label={t("nextWeek")}
              className="focus-ring flex size-7 items-center justify-center rounded-full text-text-secondary hover:bg-bg-sunken"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <AvailabilityCalendar
          compact="week"
          month={new Date(`${weekStart}T00:00:00`)}
          days={toCalendarDays(days, today)}
          selected={selectedDate}
          loading={isLoading}
          onSelect={(date) => {
            setSelectedDate(date);
            setSelectedTime(null);
          }}
          emptyMessage={t("noDaysThisWeek")}
        />
      </div>

      {selectedDate ? (
        <div className="flex flex-col gap-2">
          <span className={sectionLabel}>{t("availableTimes")}</span>
          <TimeSlotGrid
            slots={slots}
            selected={selectedTime}
            onSelect={setSelectedTime}
            timezoneLabel={t("timezone")}
            loading={isLoading}
            emptyMessage={t("noTimes")}
          />
        </div>
      ) : null}

      {summary.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-[var(--fg-radius-md)] bg-bg-sunken px-3.5 py-3">
          <span className="text-body-sm font-semibold! text-text-primary">
            {summary.join(" · ")}
          </span>
          <span className="text-meta text-text-tertiary">
            {t("finalPriceNote")}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          disabled={!selectedDate || !selectedTime}
          onClick={onBookNow}
        >
          {t("sendRequest")}
        </Button>
        {/* The main action starts disabled, which on its own reads as
            "broken" rather than "not yet". Say what is missing. */}
        {!selectedDate || !selectedTime ? (
          <p className="text-center text-meta text-text-tertiary">
            {t("pickDateHint")}
          </p>
        ) : null}
        <Button
          variant="outline"
          className="w-full"
          disabled={isOpeningChat}
          onClick={onMessage}
        >
          {isOpeningChat ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          {t("messageFirst")}
        </Button>
      </div>

      <p className="text-center text-meta text-text-tertiary">
        {t("noChargeNote")}
      </p>
    </div>
  );
}
