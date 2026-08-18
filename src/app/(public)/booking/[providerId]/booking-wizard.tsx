"use client";

import { Check, ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Radio } from "@/components/ui/radio";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, cn } from "@/lib/utils";
import type { DayAvailability } from "@/services/availability";

interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: number;
}

interface BookingWizardProps {
  providerId: string;
  providerName: string;
  providerAvatar: string | null;
  services: ServiceOption[];
  contactPhoneDefault: string;
}

type LocationType = "PROVIDER" | "CUSTOMER" | "OUTDOOR";

interface Draft {
  serviceId: string | null;
  customRequest: string;
  date: string | null;
  time: string | null;
  locationType: LocationType;
  locationAddress: string;
  numberOfPeople: string;
  notes: string;
  contactPhone: string;
  agreed: boolean;
}

const STEPS = ["Service", "Date & time", "Details", "Confirm"] as const;

function emptyDraft(contactPhoneDefault: string): Draft {
  return {
    serviceId: null,
    customRequest: "",
    date: null,
    time: null,
    locationType: "PROVIDER",
    locationAddress: "",
    numberOfPeople: "",
    notes: "",
    contactPhone: contactPhoneDefault,
    agreed: false,
  };
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function BookingWizard({
  providerId,
  providerName,
  providerAvatar,
  services,
  contactPhoneDefault,
}: BookingWizardProps) {
  const searchParams = useSearchParams();
  const storageKey = `booking-draft-${providerId}`;

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(contactPhoneDefault));
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    const fromUrl: Partial<Draft> = {
      serviceId: searchParams.get("service"),
      date: searchParams.get("date"),
      time: searchParams.get("time"),
    };
    const hasUrlPrefill = fromUrl.serviceId || fromUrl.date || fromUrl.time;

    startTransition(() => {
      if (hasUrlPrefill) {
        setDraft((prev) => ({ ...prev, ...fromUrl }));
      } else if (saved) {
        setDraft(JSON.parse(saved));
      }
      setHydrated(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, hydrated, storageKey]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const selectedService = services.find((s) => s.id === draft.serviceId) ?? null;

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return services.length === 0 ? draft.customRequest.trim().length > 0 : !!draft.serviceId;
      case 1:
        return !!draft.date && !!draft.time;
      case 2:
        return (
          draft.contactPhone.trim().length > 0 &&
          (draft.locationType === "PROVIDER" || draft.locationAddress.trim().length > 0)
        );
      case 3:
        return draft.agreed;
      default:
        return false;
    }
  }, [step, draft, services.length]);

  const onSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId,
        serviceId: draft.serviceId ?? undefined,
        date: draft.date,
        startTime: draft.time,
        locationType: draft.locationType,
        locationAddress: draft.locationAddress || undefined,
        numberOfPeople: draft.numberOfPeople ? Number(draft.numberOfPeople) : undefined,
        notes: draft.customRequest
          ? `Custom request: ${draft.customRequest}\n\n${draft.notes}`
          : draft.notes || undefined,
        contactPhone: draft.contactPhone,
      }),
    });

    const body = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(body.message ?? "Something went wrong. Please try again.");
      return;
    }

    sessionStorage.removeItem(storageKey);
    setBookingId(body.data.id);
  };

  if (bookingId) {
    return (
      <div className="mx-auto max-w-[900px] px-8 py-10">
        <Card className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-success-bg">
            <Check className="size-8 text-success" />
          </div>
          <h2 className="text-heading-lg text-text-primary">Booking request sent!</h2>
          <p className="max-w-md text-body-md text-text-secondary">
            {providerName} will respond within 24 hours. We&apos;ll email you as soon as they
            confirm.
          </p>
          <div className="flex gap-3">
            <Button
              variant="accent"
              nativeButton={false}
              render={<Link href="/dashboard/bookings" />}
            >
              View my bookings
            </Button>
            <Button variant="ghost" nativeButton={false} render={<Link href="/browse" />}>
              Browse more artists
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-8 py-10">
      <ProgressIndicator step={step} />

      <Card className="p-8">
        {step === 0 ? (
          <StepService
            services={services}
            selectedServiceId={draft.serviceId}
            customRequest={draft.customRequest}
            onSelect={(id) => update("serviceId", id)}
            onCustomRequest={(v) => update("customRequest", v)}
          />
        ) : null}

        {step === 1 ? (
          <StepDateTime
            providerId={providerId}
            providerName={providerName}
            selectedServiceId={draft.serviceId}
            duration={selectedService?.duration}
            date={draft.date}
            time={draft.time}
            onSelectDate={(d) => update("date", d)}
            onSelectTime={(t) => update("time", t)}
          />
        ) : null}

        {step === 2 ? (
          <StepDetails
            providerName={providerName}
            locationType={draft.locationType}
            locationAddress={draft.locationAddress}
            numberOfPeople={draft.numberOfPeople}
            notes={draft.notes}
            contactPhone={draft.contactPhone}
            onChange={update}
          />
        ) : null}

        {step === 3 ? (
          <StepReview
            providerName={providerName}
            providerAvatar={providerAvatar}
            service={selectedService}
            customRequest={draft.customRequest}
            date={draft.date}
            time={draft.time}
            locationType={draft.locationType}
            locationAddress={draft.locationAddress}
            numberOfPeople={draft.numberOfPeople}
            notes={draft.notes}
            agreed={draft.agreed}
            onAgree={(v) => update("agreed", v)}
          />
        ) : null}

        {submitError ? (
          <div className="mt-4 rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger">
            {submitError}
          </div>
        ) : null}
      </Card>

      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="accent" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
            Continue
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button variant="accent" disabled={!canContinue || submitting} onClick={onSubmit}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Send booking request
          </Button>
        )}
      </div>
    </div>
  );
}

function ProgressIndicator({ step }: { step: number }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((label, index) => {
        const isDone = index < step;
        const isActive = index === step;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-body-sm font-bold",
                  isDone
                    ? "bg-success text-white"
                    : isActive
                      ? "bg-brand-primary text-text-on-brand"
                      : "bg-bg-sunken text-text-tertiary",
                )}
              >
                {isDone ? <Check className="size-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-body-sm font-semibold whitespace-nowrap",
                  isActive || isDone ? "text-text-primary" : "text-text-tertiary",
                )}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 ? (
              <div
                className={cn("mx-2 h-px flex-1", isDone ? "bg-brand-primary" : "bg-bg-sunken")}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StepService({
  services,
  selectedServiceId,
  customRequest,
  onSelect,
  onCustomRequest,
}: {
  services: ServiceOption[];
  selectedServiceId: string | null;
  customRequest: string;
  onSelect: (id: string) => void;
  onCustomRequest: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading-lg text-text-primary">What do you need?</h2>

      {services.length === 0 ? (
        <div className="flex flex-col gap-2">
          <label className="text-body-sm font-semibold text-text-primary">
            Describe what you&apos;re looking for
          </label>
          <Textarea
            rows={4}
            value={customRequest}
            onChange={(e) => onCustomRequest(e.target.value)}
            placeholder="Tell them what kind of shoot, event, or product you need..."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service) => {
            const isSelected = service.id === selectedServiceId;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => onSelect(service.id)}
                className={cn(
                  "flex items-start justify-between rounded-[var(--fg-radius-md)] border p-5 text-left transition-colors",
                  isSelected
                    ? "border-brand-primary bg-success-bg ring-1 ring-brand-primary"
                    : "border-border-default bg-bg-surface",
                )}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-heading-sm text-text-primary">{service.name}</span>
                  {service.description ? (
                    <span className="text-body-sm text-text-secondary">
                      {service.description}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1 text-body-sm text-text-tertiary">
                    <Clock className="size-3.5" />
                    {service.duration} min
                  </span>
                </div>
                <span className="text-heading-sm font-bold text-text-primary">
                  {formatCurrency(service.price, service.currency)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepDateTime({
  providerId,
  providerName,
  selectedServiceId,
  duration,
  date,
  time,
  onSelectDate,
  onSelectTime,
}: {
  providerId: string;
  providerName: string;
  selectedServiceId: string | null;
  duration: number | undefined;
  date: string | null;
  time: string | null;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    startTransition(() => setIsLoading(true));
    const serviceParam = selectedServiceId ? `&serviceId=${selectedServiceId}` : "";
    fetch(
      `/api/availability/${providerId}?from=${toLocalDateKey(weekStart)}&to=${toLocalDateKey(
        new Date(weekStart.getTime() + 27 * 86_400_000),
      )}${serviceParam}`,
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

  const activeDay = days.find((d) => d.date === date);
  const today = toLocalDateKey(new Date());

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading-lg text-text-primary">When works for you?</h2>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => setWeekStart((prev) => new Date(prev.getTime() - 28 * 86_400_000))}
              className="flex size-8 items-center justify-center rounded-full hover:bg-bg-sunken"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-body-md font-semibold text-text-primary">
              {weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              aria-label="Next"
              onClick={() => setWeekStart((prev) => new Date(prev.getTime() + 28 * 86_400_000))}
              className="flex size-8 items-center justify-center rounded-full hover:bg-bg-sunken"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-text-tertiary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const d = new Date(day.date);
                const isSelected = day.date === date;
                const isToday = day.date === today;
                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={day.busy}
                    onClick={() => onSelectDate(day.date)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-[var(--fg-radius-sm)] py-2.5 text-body-sm",
                      isSelected
                        ? "bg-brand-primary text-text-on-brand"
                        : day.busy
                          ? "cursor-not-allowed text-text-tertiary opacity-40"
                          : `cursor-pointer hover:bg-bg-sunken ${isToday ? "border border-brand-primary" : ""}`,
                    )}
                  >
                    <span className="text-text-tertiary">
                      {d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
                    </span>
                    <span className="font-semibold">{d.getUTCDate()}</span>
                    {!day.busy && day.slots.some((s) => s.available) ? (
                      <span className="size-1 rounded-full bg-brand-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-body-sm text-text-tertiary">
            Times shown in your local time · needs at least 24 hours notice
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {!date ? (
            <p className="text-body-sm text-text-secondary">Select a date to see open times.</p>
          ) : (
            <>
              <span className="text-body-sm font-semibold text-text-primary">
                {new Date(date).toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                })}
              </span>
              {duration ? (
                <span className="text-body-sm text-text-tertiary">Session: {duration} min</span>
              ) : null}
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-text-tertiary" />
                </div>
              ) : activeDay && activeDay.slots.filter((s) => s.available).length > 0 ? (
                <div className="flex flex-col gap-2">
                  {activeDay.slots
                    .filter((s) => s.available)
                    .map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => onSelectTime(slot.time)}
                        className={cn(
                          "rounded-[var(--fg-radius-sm)] border py-2.5 text-body-md font-semibold",
                          time === slot.time
                            ? "border-transparent bg-brand-primary text-text-on-brand"
                            : "border-border-default bg-bg-surface text-text-primary",
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                </div>
              ) : (
                <p className="text-body-sm text-text-secondary">
                  No availability on this date — try another.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-body-sm text-text-tertiary">
        Booking {providerName ? `with ${providerName}` : ""}
      </p>
    </div>
  );
}

function StepDetails({
  providerName,
  locationType,
  locationAddress,
  numberOfPeople,
  notes,
  contactPhone,
  onChange,
}: {
  providerName: string;
  locationType: LocationType;
  locationAddress: string;
  numberOfPeople: string;
  notes: string;
  contactPhone: string;
  onChange: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-heading-lg text-text-primary">Tell {providerName} about your shoot</h2>

      <div className="flex flex-col gap-2">
        <span className="text-body-sm font-semibold text-text-primary">Location</span>
        <div className="flex flex-col gap-2">
          <Radio
            name="locationType"
            checked={locationType === "PROVIDER"}
            onChange={() => onChange("locationType", "PROVIDER")}
            label="At provider's studio"
          />
          <Radio
            name="locationType"
            checked={locationType === "CUSTOMER"}
            onChange={() => onChange("locationType", "CUSTOMER")}
            label="At my location"
          />
          <Radio
            name="locationType"
            checked={locationType === "OUTDOOR"}
            onChange={() => onChange("locationType", "OUTDOOR")}
            label="Outdoor / other"
          />
        </div>
      </div>

      {locationType !== "PROVIDER" ? (
        <Input
          label="Address"
          value={locationAddress}
          onChange={(e) => onChange("locationAddress", e.target.value)}
          placeholder="Street, ward, city"
        />
      ) : null}

      <Input
        label="Number of people"
        type="number"
        min={1}
        value={numberOfPeople}
        onChange={(e) => onChange("numberOfPeople", e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-body-sm font-semibold text-text-primary">Notes</label>
        <Textarea
          rows={4}
          maxLength={1000}
          value={notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="Describe your vision, style references, special requirements..."
        />
      </div>

      <Input
        label="Contact phone"
        type="tel"
        value={contactPhone}
        onChange={(e) => onChange("contactPhone", e.target.value)}
      />
    </div>
  );
}

const LOCATION_LABEL: Record<LocationType, string> = {
  PROVIDER: "At provider's studio",
  CUSTOMER: "At my location",
  OUTDOOR: "Outdoor / other",
};

function StepReview({
  providerName,
  providerAvatar,
  service,
  customRequest,
  date,
  time,
  locationType,
  locationAddress,
  numberOfPeople,
  notes,
  agreed,
  onAgree,
}: {
  providerName: string;
  providerAvatar: string | null;
  service: ServiceOption | null;
  customRequest: string;
  date: string | null;
  time: string | null;
  locationType: LocationType;
  locationAddress: string;
  numberOfPeople: string;
  notes: string;
  agreed: boolean;
  onAgree: (v: boolean) => void;
}) {
  const rows: [string, string][] = [
    ["Service", service?.name ?? (customRequest ? "Custom request" : "—")],
    [
      "Date",
      date
        ? new Date(date).toLocaleDateString("en-US", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })
        : "—",
    ],
    ["Time", time ?? "—"],
    ["Duration", service ? `${service.duration} min` : "—"],
    [
      "Location",
      locationType === "PROVIDER" ? LOCATION_LABEL.PROVIDER : locationAddress || LOCATION_LABEL[locationType],
    ],
    ["People", numberOfPeople || "1"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-heading-lg text-text-primary">Review your booking</h2>

      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          {providerAvatar ? <AvatarImage src={providerAvatar} alt="" /> : null}
          <AvatarFallback>{providerName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-body-md font-semibold text-text-primary">{providerName}</span>
      </div>

      <div className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between py-2.5">
            <span className="text-body-sm text-text-tertiary">{label}</span>
            <span className="text-body-md font-semibold text-text-primary">{value}</span>
          </div>
        ))}
      </div>

      {service ? (
        <div className="flex flex-col divide-y divide-border-subtle border-b border-border-subtle">
          <div className="flex justify-between py-2.5 text-body-md">
            <span className="text-text-secondary">Service price</span>
            <span className="text-text-primary">{formatCurrency(service.price, service.currency)}</span>
          </div>
          <div className="flex justify-between py-2.5 text-heading-md font-bold text-text-primary">
            <span>Total</span>
            <span>{formatCurrency(service.price, service.currency)}</span>
          </div>
        </div>
      ) : null}

      {notes ? (
        <div className="flex flex-col gap-1">
          <span className="text-body-sm text-text-tertiary">Notes</span>
          <p className="text-body-md text-text-primary">{notes}</p>
        </div>
      ) : null}

      <div className="rounded-[var(--fg-radius-md)] bg-bg-sunken p-4 text-body-sm text-text-secondary">
        Free cancellation up to 48 hours before your session. Cancelling within 24 hours may be
        subject to a fee once payments are enabled.
      </div>

      <Checkbox
        checked={agreed}
        onCheckedChange={(checked) => onAgree(checked === true)}
        label="I agree to the booking terms"
      />
    </div>
  );
}
