"use client";

import { Check, ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { ModelSafetyNotice } from "@/components/booking/model-safety-notice";
import { termsChunk } from "@/components/legal/terms-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateLong,
  formatDayMonth,
  formatDurationHours,
  formatMonthYear,
} from "@/lib/format";
import { WEEKDAY_SHORT_LABELS_VI } from "@/lib/constants";
import { formatCurrency, cn, mondayFirstColumn } from "@/lib/utils";
import type { DayAvailability } from "@/services/availability";

const SHOOT_TYPE_OPTION_KEYS = [
  { value: "", key: "shootTypeOptions.notSpecified" },
  { value: "Editorial", key: "shootTypeOptions.editorial" },
  { value: "Commercial", key: "shootTypeOptions.commercial" },
  { value: "Portfolio building", key: "shootTypeOptions.portfolioBuilding" },
  { value: "TFP collaboration", key: "shootTypeOptions.tfpCollaboration" },
  { value: "Event", key: "shootTypeOptions.event" },
  { value: "Other", key: "shootTypeOptions.other" },
] as const;

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
  isModel?: boolean;
  // Crew-hire (Prompt B7, VIỆC 1) — non-null only when the viewer holds
  // PHOTOGRAPHER/VIDEOGRAPHER and this provider offers MUA/Model/Studio.
  requesterCrewRole?: string | null;
}

interface ParentBookingOption {
  id: string;
  date: string;
  startTime: string;
  service: { name: string } | null;
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
  // Model-booking-specific — see docs/guides/fgrapher-prompts-batch-2.md
  // §3c item 7. No dedicated Booking columns exist for these; they're
  // folded into the free-text `notes` field at submit time, the same
  // pattern already used for `customRequest`.
  shootType: string;
  usageRights: string;
  wardrobeNotes: string;
  muaProvided: boolean;
}

const STEP_KEYS = [
  "steps.service",
  "steps.dateTime",
  "steps.details",
  "steps.confirm",
] as const;

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
    shootType: "",
    usageRights: "",
    wardrobeNotes: "",
    muaProvided: false,
  };
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
  isModel,
  requesterCrewRole,
}: BookingWizardProps) {
  const t = useTranslations("publicPages.booking");
  const searchParams = useSearchParams();
  const storageKey = `booking-draft-${providerId}`;

  const [step, setStep] = useState(0);
  const stepSettledRef = useRef(false);

  // Every step is taller than the viewport on a phone, and the Back/Continue
  // buttons sit at the bottom — so changing step left the scroll position down
  // there and the new step opened already scrolled past its own heading,
  // looking as though the page had skipped content.
  //
  // In an effect keyed on `step`, not in the click handler: the handler runs
  // before React commits the new step, so scrolling there measures the
  // outgoing layout. Skipping the first run keeps a fresh (or deep-linked)
  // page where it loaded instead of yanking it.
  useEffect(() => {
    if (!stepSettledRef.current) {
      stepSettledRef.current = true;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);
  const [draft, setDraft] = useState<Draft>(() =>
    emptyDraft(contactPhoneDefault),
  );
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  // Crew-hire (Prompt B7, VIỆC 1) — "Gắn vào đơn khách hàng".
  const [parentBookingOptions, setParentBookingOptions] = useState<
    ParentBookingOption[]
  >([]);
  const [parentBookingId, setParentBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!requesterCrewRole) return;
    fetch("/api/bookings?status=CONFIRMED")
      .then((res) => res.json())
      .then((body) => setParentBookingOptions(body.data ?? []));
  }, [requesterCrewRole]);

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
    // Deliberately run once on mount only — re-running on searchParams/
    // storageKey change would re-hydrate and clobber whatever the user has
    // already typed into the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, hydrated, storageKey]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const selectedService =
    services.find((s) => s.id === draft.serviceId) ?? null;

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return services.length === 0
          ? draft.customRequest.trim().length > 0
          : !!draft.serviceId;
      case 1:
        return !!draft.date && !!draft.time;
      case 2:
        return (
          draft.contactPhone.trim().length > 0 &&
          (draft.locationType === "PROVIDER" ||
            draft.locationAddress.trim().length > 0)
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

    const modelDetailsBlock = isModel
      ? [
          draft.shootType
            ? t("notes.shootType", { value: draft.shootType })
            : null,
          draft.usageRights
            ? t("notes.usageRights", { value: draft.usageRights })
            : null,
          draft.wardrobeNotes
            ? t("notes.wardrobeStyling", { value: draft.wardrobeNotes })
            : null,
          draft.muaProvided ? t("notes.muaProvidedByCustomer") : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const notesParts = [
      draft.customRequest
        ? t("notes.customRequest", { value: draft.customRequest })
        : null,
      modelDetailsBlock || null,
      draft.notes || null,
    ].filter(Boolean);

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
        numberOfPeople: draft.numberOfPeople
          ? Number(draft.numberOfPeople)
          : undefined,
        notes: notesParts.length > 0 ? notesParts.join("\n\n") : undefined,
        contactPhone: draft.contactPhone,
        parentBookingId: parentBookingId ?? undefined,
        requesterRole: parentBookingId ? requesterCrewRole : undefined,
      }),
    });

    const body = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(body.message ?? t("genericError"));
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
          <h2 className="text-heading-lg text-text-primary">
            {t("success.heading")}
          </h2>
          <p className="max-w-md text-body-md text-text-secondary">
            {t("success.body", { providerName })}
          </p>
          <div className="flex gap-3">
            <Button
              variant="accent"
              nativeButton={false}
              render={<Link href="/dashboard/bookings" />}
            >
              {t("success.viewBookings")}
            </Button>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/browse" />}
            >
              {t("success.browseMore")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-8 py-10">
      {/* QA: no <h1> anywhere in the wizard — each step already has its
          own <h2> ("Bạn cần gì?", "Chọn ngày & giờ", ...), so a second
          large visible title here would be redundant; a screen-reader
          -only one still gives the page an actual name. */}
      <h1 className="sr-only">{t("pageTitle")}</h1>
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
            isModel={isModel}
            shootType={draft.shootType}
            usageRights={draft.usageRights}
            wardrobeNotes={draft.wardrobeNotes}
            muaProvided={draft.muaProvided}
            onChange={update}
            parentBookingOptions={requesterCrewRole ? parentBookingOptions : []}
            parentBookingId={parentBookingId}
            onParentBookingChange={setParentBookingId}
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
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <ChevronLeft className="size-4" />
          {t("back")}
        </Button>
        {step < STEP_KEYS.length - 1 ? (
          <Button
            variant="accent"
            disabled={!canContinue}
            onClick={() => setStep((s) => s + 1)}
          >
            {t("continueBtn")}
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            variant="accent"
            disabled={!canContinue || submitting}
            onClick={onSubmit}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("submitBtn")}
          </Button>
        )}
      </div>
    </div>
  );
}

function ProgressIndicator({ step }: { step: number }) {
  const t = useTranslations("publicPages.booking");
  return (
    <div className="mb-8 flex items-center">
      {STEP_KEYS.map((key, index) => {
        const label = t(key);
        const isDone = index < step;
        const isActive = index === step;
        return (
          <div key={key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-body-sm font-bold!",
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
                  "text-body-sm font-semibold! whitespace-nowrap",
                  isActive || isDone
                    ? "text-text-primary"
                    : "text-text-tertiary",
                )}
              >
                {label}
              </span>
            </div>
            {index < STEP_KEYS.length - 1 ? (
              <div
                className={cn(
                  "mx-2 h-px flex-1",
                  isDone ? "bg-brand-primary" : "bg-bg-sunken",
                )}
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
  const t = useTranslations("publicPages.booking");
  const serviceT = useTranslations("sharedComponents.service");
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading-lg text-text-primary">
        {t("stepService.heading")}
      </h2>

      {services.length === 0 ? (
        <div className="flex flex-col gap-2">
          <label className="text-body-sm font-semibold! text-text-primary">
            {t("stepService.describeLabel")}
          </label>
          <Textarea
            rows={4}
            value={customRequest}
            onChange={(e) => onCustomRequest(e.target.value)}
            placeholder={t("stepService.describePlaceholder")}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {services.map((service) => {
            const isSelected = service.id === selectedServiceId;
            return (
              // Fully stacked: the name and the description each get the
              // card's whole width, and duration/price share the last row.
              // This used to be a single flex row with the price in its own
              // column, which on a phone left the description ~43% of a card
              // that is itself only ~260px wide inside the step's Card — so a
              // package description wrapped every two or three words, and a
              // longer name broke across three lines.
              <button
                key={service.id}
                type="button"
                onClick={() => onSelect(service.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[var(--fg-radius-md)] border p-5 text-left transition-colors",
                  isSelected
                    ? "border-brand-primary bg-success-bg ring-1 ring-brand-primary"
                    : "border-border-default bg-bg-surface",
                )}
              >
                <span className="text-heading-sm text-text-primary">
                  {service.name}
                </span>
                {service.description ? (
                  <span className="whitespace-pre-line text-body-sm leading-relaxed text-text-secondary">
                    {service.description}
                  </span>
                ) : null}
                {/* Duration and price each get their own line. Sharing one
                    row put a ~26-character label next to the price inside a
                    ~220px card, which broke the label across three lines. */}
                <span className="flex items-center gap-1 pt-0.5 text-body-sm text-text-tertiary">
                  <Clock className="size-3.5 shrink-0" />
                  {serviceT("sessionDuration", {
                    hours: formatDurationHours(service.duration),
                  })}
                </span>
                <span className="text-heading-sm font-bold! text-text-primary">
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
  const t = useTranslations("publicPages.booking");
  const serviceT = useTranslations("sharedComponents.service");
  // A real calendar month, not a rolling 28-day window. The window version
  // paged by ±28 days under a "tháng 9 năm 2026" heading, so its columns were
  // whatever weekdays the window happened to start on — Sunday landed in a
  // different column on every page — and a page could run past the month it
  // was labelled with (… 29, 30, 1 …).
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const monthEnd = useMemo(
    () => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0),
    [monthCursor],
  );

  useEffect(() => {
    let cancelled = false;
    startTransition(() => setIsLoading(true));
    const serviceParam = selectedServiceId
      ? `&serviceId=${selectedServiceId}`
      : "";
    fetch(
      `/api/availability/${providerId}?from=${toLocalDateKey(
        monthCursor,
      )}&to=${toLocalDateKey(monthEnd)}${serviceParam}`,
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
  }, [providerId, monthCursor, monthEnd, selectedServiceId]);

  const activeDay = days.find((d) => d.date === date);
  const today = toLocalDateKey(new Date());

  const dayByDate = useMemo(
    () => new Map(days.map((d) => [d.date, d])),
    [days],
  );

  // Leading blanks so the 1st lands under its real weekday column, then one
  // cell per day of the month. Monday-first, matching every other fixed grid
  // in the app (see WEEK_STARTS_ON).
  const cells = useMemo<(string | null)[]>(
    () => [
      ...Array.from(
        { length: mondayFirstColumn(monthCursor.getDay()) },
        () => null,
      ),
      ...Array.from({ length: monthEnd.getDate() }, (_, i) =>
        toLocalDateKey(
          new Date(monthCursor.getFullYear(), monthCursor.getMonth(), i + 1),
        ),
      ),
    ],
    [monthCursor, monthEnd],
  );

  // Nothing bookable is ever in a past month, so don't let the visitor page
  // back into empty grids.
  const atCurrentMonth =
    monthCursor.getFullYear() === new Date().getFullYear() &&
    monthCursor.getMonth() === new Date().getMonth();

  const changeMonth = (delta: number) =>
    setMonthCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading-lg text-text-primary">
        {t("stepDateTime.heading")}
      </h2>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label={t("stepDateTime.previous")}
              disabled={atCurrentMonth}
              onClick={() => changeMonth(-1)}
              className="flex size-8 items-center justify-center rounded-full hover:bg-bg-sunken disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-body-md font-semibold! text-text-primary">
              {formatMonthYear(monthCursor)}
            </span>
            <button
              type="button"
              aria-label={t("stepDateTime.next")}
              onClick={() => changeMonth(1)}
              className="flex size-8 items-center justify-center rounded-full hover:bg-bg-sunken"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Fixed weekday header — the per-cell labels the rolling window
              needed are redundant once the columns mean something. */}
          <div className="grid grid-cols-7 gap-2 text-center text-caption-upper tracking-[0.06em] text-text-tertiary">
            {WEEKDAY_SHORT_LABELS_VI.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-text-tertiary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {cells.map((dateKey, i) => {
                if (!dateKey) return <span key={`empty-${i}`} aria-hidden />;
                const day = dayByDate.get(dateKey);
                // A day the availability window didn't cover (or one already
                // past) is shown, but not selectable — leaving a hole in the
                // month would break the columns this grid exists to fix.
                const unavailable = !day || day.busy || dateKey < today;
                const isSelected = dateKey === date;
                const isToday = dateKey === today;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={unavailable}
                    onClick={() => onSelectDate(dateKey)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-[var(--fg-radius-sm)] py-2.5 text-body-sm",
                      isSelected
                        ? "bg-brand-primary text-text-on-brand"
                        : unavailable
                          ? "cursor-not-allowed text-text-tertiary opacity-40"
                          : `cursor-pointer hover:bg-bg-sunken ${isToday ? "border border-brand-primary" : ""}`,
                    )}
                  >
                    <span className="font-semibold">
                      {Number(dateKey.slice(8, 10))}
                    </span>
                    {!unavailable && day.slots.some((s) => s.available) ? (
                      <span className="size-1 rounded-full bg-brand-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-body-sm text-text-tertiary">
            {t("stepDateTime.localTimeNote")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {!date ? (
            <p className="text-body-sm text-text-secondary">
              {t("stepDateTime.selectDatePrompt")}
            </p>
          ) : (
            <>
              <span className="text-body-sm font-semibold! text-text-primary">
                {formatDateLong(date)}
              </span>
              {duration ? (
                <span className="text-body-sm text-text-tertiary">
                  {serviceT("sessionDuration", {
                    hours: formatDurationHours(duration),
                  })}
                </span>
              ) : null}
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-text-tertiary" />
                </div>
              ) : activeDay &&
                activeDay.slots.filter((s) => s.available).length > 0 ? (
                <div className="flex flex-col gap-2">
                  {activeDay.slots
                    .filter((s) => s.available)
                    .map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => onSelectTime(slot.time)}
                        className={cn(
                          "rounded-[var(--fg-radius-sm)] border py-2.5 text-body-md font-semibold!",
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
                  {t("stepDateTime.noAvailability")}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <p className="text-body-sm text-text-tertiary">
        {providerName
          ? t("stepDateTime.bookingWith", { providerName })
          : t("stepDateTime.booking")}
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
  isModel,
  shootType,
  usageRights,
  wardrobeNotes,
  muaProvided,
  onChange,
  parentBookingOptions,
  parentBookingId,
  onParentBookingChange,
}: {
  providerName: string;
  locationType: LocationType;
  locationAddress: string;
  numberOfPeople: string;
  notes: string;
  contactPhone: string;
  isModel?: boolean;
  shootType: string;
  usageRights: string;
  wardrobeNotes: string;
  muaProvided: boolean;
  onChange: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  parentBookingOptions: ParentBookingOption[];
  parentBookingId: string | null;
  onParentBookingChange: (id: string | null) => void;
}) {
  const t = useTranslations("publicPages.booking");
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-heading-lg text-text-primary">
        {t("stepDetails.heading", { providerName })}
      </h2>

      {isModel ? <ModelSafetyNotice /> : null}

      {parentBookingOptions.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <Checkbox
            checked={parentBookingId !== null}
            onCheckedChange={(checked) =>
              onParentBookingChange(
                checked === true ? parentBookingOptions[0].id : null,
              )
            }
            label={t("stepDetails.attachToJob")}
          />
          {parentBookingId !== null ? (
            <NativeSelect
              label={t("stepDetails.clientJobLabel")}
              value={parentBookingId}
              onChange={(v) => onParentBookingChange(v)}
              options={parentBookingOptions.map((option) => ({
                value: option.id,
                label: `${formatDayMonth(option.date)} ${option.startTime} — ${option.service?.name ?? t("stepDetails.customRequestOption")}`,
              }))}
            />
          ) : null}
        </div>
      ) : null}

      {isModel ? (
        <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle p-3.5">
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            {t("stepDetails.shootDetails")}
          </span>
          <NativeSelect
            label={t("stepDetails.shootTypeLabel")}
            value={shootType}
            onChange={(v) => onChange("shootType", v)}
            options={SHOOT_TYPE_OPTION_KEYS.map((option) => ({
              value: option.value,
              label: t(option.key),
            }))}
          />
          <Input
            label={t("stepDetails.usageRightsLabel")}
            placeholder={t("stepDetails.usageRightsPlaceholder")}
            value={usageRights}
            onChange={(e) => onChange("usageRights", e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-body-sm font-semibold! text-text-primary">
              {t("stepDetails.wardrobeLabel")}
            </label>
            <Textarea
              rows={2}
              value={wardrobeNotes}
              onChange={(e) => onChange("wardrobeNotes", e.target.value)}
              placeholder={t("stepDetails.wardrobePlaceholder")}
            />
          </div>
          <Checkbox
            checked={muaProvided}
            onCheckedChange={(checked) =>
              onChange("muaProvided", checked === true)
            }
            label={t("stepDetails.muaProvidedLabel")}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-body-sm font-semibold! text-text-primary">
          {t("stepDetails.locationLabel")}
        </span>
        <div className="flex flex-col gap-2">
          <Radio
            name="locationType"
            checked={locationType === "PROVIDER"}
            onChange={() => onChange("locationType", "PROVIDER")}
            label={t("stepDetails.locationProvider")}
          />
          <Radio
            name="locationType"
            checked={locationType === "CUSTOMER"}
            onChange={() => onChange("locationType", "CUSTOMER")}
            label={t("stepDetails.locationCustomer")}
          />
          <Radio
            name="locationType"
            checked={locationType === "OUTDOOR"}
            onChange={() => onChange("locationType", "OUTDOOR")}
            label={t("stepDetails.locationOutdoor")}
          />
        </div>
      </div>

      {locationType !== "PROVIDER" ? (
        <Input
          label={t("stepDetails.addressLabel")}
          value={locationAddress}
          onChange={(e) => onChange("locationAddress", e.target.value)}
          placeholder={t("stepDetails.addressPlaceholder")}
        />
      ) : null}

      <Input
        label={t("stepDetails.numberOfPeopleLabel")}
        type="number"
        min={1}
        value={numberOfPeople}
        onChange={(e) => onChange("numberOfPeople", e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-body-sm font-semibold! text-text-primary">
          {t("stepDetails.notesLabel")}
        </label>
        <Textarea
          rows={4}
          maxLength={1000}
          value={notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder={t("stepDetails.notesPlaceholder")}
        />
      </div>

      <Input
        label={t("stepDetails.contactPhoneLabel")}
        type="tel"
        value={contactPhone}
        onChange={(e) => onChange("contactPhone", e.target.value)}
      />
    </div>
  );
}

function getLocationLabel(
  t: ReturnType<typeof useTranslations>,
): Record<LocationType, string> {
  return {
    PROVIDER: t("stepDetails.locationProvider"),
    CUSTOMER: t("stepDetails.locationCustomer"),
    OUTDOOR: t("stepDetails.locationOutdoor"),
  };
}

// Every label/value line in the review card goes through this, so they can't
// drift apart again. The rows used to be written inline twice with different
// type: the detail rows as small-grey label + medium-semibold value, the
// price rows as medium-secondary label + medium-regular value.
//
// Two flex bugs went with that. The label had no `shrink-0`, so a long value
// squeezed it until it broke across lines — "Địa điểm" rendered as "Địa" /
// "điểm". And the value had no `text-right`, so the moment it wrapped its
// lines aligned left while every single-line value above stayed right,
// breaking the column. `items-baseline` sits the two different type sizes on
// the same line rather than on their box tops.
function ReviewRow({
  label,
  value,
  total = false,
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span
        className={cn(
          "shrink-0",
          total
            ? "text-heading-md font-bold! text-text-primary"
            : "text-body-sm text-text-tertiary",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 text-right break-words text-text-primary",
          total ? "text-heading-md font-bold!" : "text-body-md font-semibold!",
        )}
      >
        {value}
      </span>
    </div>
  );
}

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
  const t = useTranslations("publicPages.booking");
  const serviceT = useTranslations("sharedComponents.service");
  const locationLabel = getLocationLabel(t);
  const rows: [string, string][] = [
    [
      t("stepReview.rowService"),
      service?.name ??
        (customRequest ? t("stepDetails.customRequestOption") : "—"),
    ],
    [t("stepReview.rowDate"), date ? formatDateLong(date) : "—"],
    [t("stepReview.rowTime"), time ?? "—"],
    [
      t("stepReview.rowDuration"),
      service
        ? serviceT("durationHours", {
            hours: formatDurationHours(service.duration),
          })
        : "—",
    ],
    [
      t("stepReview.rowLocation"),
      locationType === "PROVIDER"
        ? locationLabel.PROVIDER
        : locationAddress || locationLabel[locationType],
    ],
    [t("stepReview.rowPeople"), numberOfPeople || "1"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-heading-lg text-text-primary">
        {t("stepReview.heading")}
      </h2>

      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          {providerAvatar ? <AvatarImage src={providerAvatar} alt="" /> : null}
          <AvatarFallback>{providerName[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-body-md font-semibold! text-text-primary">
          {providerName}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
        {rows.map(([label, value]) => (
          <ReviewRow key={label} label={label} value={value} />
        ))}
      </div>

      {service ? (
        <div className="flex flex-col divide-y divide-border-subtle border-b border-border-subtle">
          <ReviewRow
            label={t("stepReview.servicePrice")}
            value={formatCurrency(service.price, service.currency)}
          />
          <ReviewRow
            label={t("stepReview.total")}
            value={formatCurrency(service.price, service.currency)}
            total
          />
        </div>
      ) : null}

      {notes ? (
        <div className="flex flex-col gap-1">
          <span className="text-body-sm text-text-tertiary">
            {t("stepReview.notesLabel")}
          </span>
          <p className="text-body-md text-text-primary">{notes}</p>
        </div>
      ) : null}

      <div className="rounded-[var(--fg-radius-md)] bg-bg-sunken p-4 text-body-sm text-text-secondary">
        {t("stepReview.cancellationNotice")}
      </div>

      <Checkbox
        checked={agreed}
        onCheckedChange={(checked) => onAgree(checked === true)}
        label={t.rich("stepReview.agreeTerms", { terms: termsChunk })}
      />
    </div>
  );
}
