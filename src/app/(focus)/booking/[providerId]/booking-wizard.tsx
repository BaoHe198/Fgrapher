"use client";

import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
  AvailabilityCalendar,
  toCalendarDays,
} from "@/components/booking/availability-calendar";
import {
  BookingSummary,
  type BookingSummaryRow,
} from "@/components/booking/booking-summary";
import { ModelSafetyNotice } from "@/components/booking/model-safety-notice";
import { BookingVisual } from "@/components/booking/booking-visual";
import { SunArc } from "@/components/booking/sun-arc";
import { TimeSlotGrid } from "@/components/booking/time-slot-grid";
import {
  ReferenceMediaField,
  type ReferenceMedia,
} from "@/components/forms/reference-media-field";
import { termsChunk } from "@/components/legal/terms-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceCard, ChoiceCardGroup } from "@/components/ui/choice-card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StepProgress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateLong, formatDayMonth } from "@/lib/format";
import { isGoldenHourSlot, sunTimes } from "@/lib/sun";
import { cn, formatCurrency } from "@/lib/utils";
import { MAX_REFERENCE_MEDIA } from "@/lib/validations/reference-media";
import { vietnamDateKey } from "@/lib/vietnam/date";
import type { DayAvailability } from "@/services/availability";

// The booking request flow, redesign 09/2026: six short steps - package,
// day, time, place, notes, review - each one screen, with the request
// summary beside them (every row has its own "Sửa" back to its step) and a
// film-frame counter ("03/06") instead of numbered circles. Nothing about
// what is sent changed: the same fields reach POST /api/bookings.

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
  editedPhotoCount?: number | null;
  deliveryDays?: number | null;
}

interface BookingWizardProps {
  providerId: string;
  providerName: string;
  providerAvatar: string | null;
  providerUsername: string | null;
  providerRating: number | null;
  providerReviewCount: number;
  providerVerified: boolean;
  /** "Phản hồi trong 2 giờ", or the 48-hour confirmation promise. */
  responseNote: string;
  /** ~10 km-rounded coordinates for golden-hour hints, or null. */
  sunPoint: { latitude: number; longitude: number } | null;
  /** The artist's own approved photos for the darkroom pane. */
  providerPhotos: string[];
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
  /** "Tùy chỉnh": no package, the customer describes what they need. */
  custom: boolean;
  customRequest: string;
  date: string | null;
  time: string | null;
  // null until the customer picks one. It used to start on PROVIDER ("at
  // the provider's studio"), which a customer describing an outdoor shoot
  // with a freelancer who has no studio could — and did — sail past,
  // sending a booking with the wrong place on it. Nothing is chosen for them.
  locationType: LocationType | null;
  locationAddress: string;
  numberOfPeople: string;
  notes: string;
  // Uploaded reference photo/video URLs — sent as Booking.referenceImages.
  referenceMedia: ReferenceMedia[];
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

const STEPS = [
  "package",
  "date",
  "time",
  "location",
  "notes",
  "review",
] as const;
type Step = (typeof STEPS)[number];
const REVIEW = STEPS.length - 1;

// "Lưu nháp & thoát" keeps a draft on this device for a week. The contact
// phone is left out of what is stored: it is refilled from the account.
const VN_CLOCK = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function emptyDraft(contactPhoneDefault: string): Draft {
  return {
    serviceId: null,
    custom: false,
    customRequest: "",
    date: null,
    time: null,
    locationType: null,
    locationAddress: "",
    numberOfPeople: "",
    notes: "",
    referenceMedia: [],
    contactPhone: contactPhoneDefault,
    agreed: false,
    shootType: "",
    usageRights: "",
    wardrobeNotes: "",
    muaProvided: false,
  };
}

function readStoredDraft(key: string): Partial<Draft> | null {
  try {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      draft?: Partial<Draft>;
    } & Partial<Draft>;
    // Older drafts were stored bare in sessionStorage; newer ones carry
    // savedAt so a week-old half-booking doesn't reappear forever.
    if (parsed.draft) {
      if (!parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS)
        return null;
      return parsed.draft;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDraft(key: string, draft: Draft) {
  try {
    const { contactPhone: _phone, agreed: _agreed, ...rest } = draft;
    void _phone;
    void _agreed;
    localStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), draft: rest }),
    );
    sessionStorage.removeItem(key);
  } catch {
    // Private mode or storage full: the draft simply isn't kept.
  }
}

function clearStoredDraft(key: string) {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

export function BookingWizard({
  providerId,
  providerName,
  providerAvatar,
  providerUsername,
  providerRating,
  providerReviewCount,
  providerVerified,
  responseNote,
  sunPoint,
  providerPhotos,
  services,
  contactPhoneDefault,
  isModel,
  requesterCrewRole,
}: BookingWizardProps) {
  const t = useTranslations("publicPages.booking");
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryT = useTranslations("profileCategory");
  // Search context carried over from /fmap. Bookings only store a start
  // time, so the requested end and category travel as a banner + note.
  const fmapContext = useMemo(() => {
    if (searchParams.get("source") !== "fmap") return null;
    const pick = (key: string, pattern: RegExp) => {
      const value = searchParams.get(key);
      return value && pattern.test(value) ? value : null;
    };
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    return {
      date: pick("date", /^\d{4}-\d{2}-\d{2}$/),
      start: pick("time", time),
      end: pick("end", time),
      category: pick("category", /^[A-Z_]{2,40}$/),
    };
  }, [searchParams]);
  const fmapCategoryLabel =
    fmapContext?.category && categoryT.has(fmapContext.category)
      ? categoryT(fmapContext.category)
      : null;
  const storageKey = `booking-draft-${providerId}`;
  const profileHref = providerUsername
    ? `/profile/${providerUsername}`
    : "/browse";

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"next" | "back">("next");
  const stepSettledRef = useRef(false);
  const goTo = (next: number) => {
    setDirection(next > step ? "next" : "back");
    setStep(next);
  };

  // Every step is taller than the viewport on a phone, and the Back/Continue
  // buttons sit at the bottom — so changing step left the scroll position down
  // there and the new step opened already scrolled past its own heading.
  // In an effect keyed on `step`, not in the click handler: the handler runs
  // before React commits the new step. Skipping the first run keeps a fresh
  // (or deep-linked) page where it loaded instead of yanking it.
  useEffect(() => {
    if (!stepSettledRef.current) {
      stepSettledRef.current = true;
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    // The new step's heading takes focus, so a screen reader announces it.
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [step]);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState<Draft>(() =>
    emptyDraft(contactPhoneDefault),
  );
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  // The success screen replaces a long form; without this the phone stayed
  // scrolled to the footer and never showed the "sent" confirmation.
  useEffect(() => {
    if (bookingId) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [bookingId]);
  const [providerZaloUrl, setProviderZaloUrl] = useState<string | null>(null);
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
    const saved = readStoredDraft(storageKey);
    const fromUrl: Partial<Draft> = {
      serviceId: searchParams.get("service"),
      date: searchParams.get("date"),
      time: searchParams.get("time"),
    };
    const hasUrlPrefill = fromUrl.serviceId || fromUrl.date || fromUrl.time;

    startTransition(() => {
      if (hasUrlPrefill) {
        const fmapNotes =
          fmapContext?.start && fmapContext.end
            ? [
                t("fmapContext.notesLine", {
                  start: fmapContext.start,
                  end: fmapContext.end,
                }),
                fmapCategoryLabel
                  ? t("fmapContext.notesCategory", {
                      category: fmapCategoryLabel,
                    })
                  : null,
              ]
                .filter(Boolean)
                .join("\n")
            : "";
        setDraft((prev) => ({
          ...prev,
          ...fromUrl,
          notes: prev.notes || fmapNotes,
        }));
        // Arriving with a package, day and time already picked on the
        // profile: open at the first thing still missing.
        if (fromUrl.serviceId && fromUrl.date && fromUrl.time) setStep(3);
        else if (fromUrl.serviceId && fromUrl.date) setStep(2);
        else if (fromUrl.serviceId) setStep(1);
      } else if (saved) {
        // Merged over a fresh draft, not used as-is: a draft saved before a
        // field existed would otherwise come back without it.
        setDraft({
          ...emptyDraft(contactPhoneDefault),
          ...saved,
          // Drafts saved before references carried Cloudinary public IDs
          // cannot pass the server's ownership verification. Omit only those
          // old attachments; the rest of the booking draft stays intact.
          referenceMedia: Array.isArray(saved.referenceMedia)
            ? saved.referenceMedia.filter(
                (item): item is ReferenceMedia =>
                  typeof item === "object" &&
                  item !== null &&
                  typeof item.url === "string" &&
                  typeof item.publicId === "string",
              )
            : [],
          contactPhone: contactPhoneDefault,
          agreed: false,
        });
      }
      setHydrated(true);
    });
    // Deliberately run once on mount only — re-running on searchParams/
    // storageKey change would re-hydrate and clobber whatever the user has
    // already typed into the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Đã lưu nháp HH:mm" in the header - the draft saves itself on every
  // change; this shows when it last did.
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const draftChanged = useRef(false);
  useEffect(() => {
    if (!hydrated || bookingId) return;
    writeStoredDraft(storageKey, draft);
    if (draftChanged.current) {
      startTransition(() => setSavedAt(new Date()));
    }
    draftChanged.current = true;
  }, [draft, hydrated, storageKey, bookingId]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const selectedService =
    services.find((s) => s.id === draft.serviceId) ?? null;
  const isCustom = draft.custom || services.length === 0;

  // One month of availability, shared by the day and time steps.
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [daysLoading, setDaysLoading] = useState(true);
  const [daysError, setDaysError] = useState(false);
  // A day picked on the profile (or restored) can sit in a later month.
  useEffect(() => {
    if (!draft.date) return;
    const [y, m] = draft.date.split("-").map(Number);
    startTransition(() =>
      setMonthCursor((prev) =>
        prev.getFullYear() === y && prev.getMonth() === m - 1
          ? prev
          : new Date(y, m - 1, 1),
      ),
    );
    // Only on arrival/restore; later month paging is the customer's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setDaysLoading(true);
      setDaysError(false);
    });
    const first = monthCursor;
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const serviceParam = draft.serviceId ? `&serviceId=${draft.serviceId}` : "";
    fetch(
      `/api/availability/${providerId}?from=${key(first)}&to=${key(last)}${serviceParam}`,
    )
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled)
          startTransition(() => {
            setDays(body.data?.dates ?? []);
            setDaysLoading(false);
          });
      })
      .catch(() => {
        if (!cancelled)
          startTransition(() => {
            setDaysError(true);
            setDaysLoading(false);
          });
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, monthCursor, draft.serviceId]);

  const today = vietnamDateKey();
  const atCurrentMonth =
    monthCursor.getFullYear() === new Date().getFullYear() &&
    monthCursor.getMonth() === new Date().getMonth();
  const activeDay = days.find((d) => d.date === draft.date);
  const sun = useMemo(
    () =>
      sunPoint && draft.date
        ? sunTimes(draft.date, sunPoint.latitude, sunPoint.longitude)
        : null,
    [draft.date, sunPoint],
  );
  const slots = useMemo(() => {
    if (!activeDay || !draft.date) return [];
    return activeDay.slots.map((slot) => ({
      start: slot.time,
      status: slot.available ? ("available" as const) : ("booked" as const),
      golden: sun ? isGoldenHourSlot(slot.time, sun) : false,
    }));
  }, [activeDay, draft.date, sun]);

  const stepValid = (index: number): boolean => {
    switch (STEPS[index]) {
      case "package":
        return isCustom
          ? draft.customRequest.trim().length > 0
          : !!draft.serviceId;
      case "date":
        return !!draft.date;
      case "time":
        return !!draft.time;
      case "location":
        return (
          draft.locationType !== null &&
          (draft.locationType === "PROVIDER" ||
            draft.locationAddress.trim().length > 0)
        );
      case "notes":
        return draft.contactPhone.trim().length > 0;
      case "review":
        return draft.agreed;
    }
  };
  const canContinue = stepValid(step);

  // What the disabled Continue button is waiting for. A greyed-out button
  // alone left people guessing (24/09 audit).
  const missingHint = canContinue
    ? null
    : (
        {
          package: t("missingHint.service"),
          date: t("flow.missing.date"),
          time: t("flow.missing.time"),
          location:
            draft.locationType !== null && draft.locationType !== "PROVIDER"
              ? t("missingHint.address")
              : t("flow.missing.location"),
          notes: t("flow.missing.phone"),
          review: t("missingHint.agree"),
        } satisfies Record<Step, string>
      )[STEPS[step]];

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
      isCustom && draft.customRequest
        ? t("notes.customRequest", { value: draft.customRequest })
        : null,
      modelDetailsBlock || null,
      draft.notes || null,
    ].filter(Boolean);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          serviceId: isCustom ? undefined : (draft.serviceId ?? undefined),
          date: draft.date,
          startTime: draft.time,
          locationType: draft.locationType,
          locationAddress: draft.locationAddress || undefined,
          numberOfPeople: draft.numberOfPeople
            ? Number(draft.numberOfPeople)
            : undefined,
          notes: notesParts.length > 0 ? notesParts.join("\n\n") : undefined,
          contactPhone: draft.contactPhone,
          referenceImages:
            draft.referenceMedia.length > 0 ? draft.referenceMedia : undefined,
          parentBookingId: parentBookingId ?? undefined,
          requesterRole: parentBookingId ? requesterCrewRole : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSubmitError(body.message ?? t("genericError"));
        return;
      }
      clearStoredDraft(storageKey);
      setBookingId(body.data.id);
      setProviderZaloUrl(body.data.providerZaloUrl ?? null);
    } catch {
      setSubmitError(t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (bookingId) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-10 sm:px-8">
        <Card className="flex flex-col items-center gap-4 py-16 text-center">
          {/* Hand-drawn tick rather than a static icon: this is the moment
              the request actually leaves, the one point in the customer
              flow worth marking. The ring settles, then the stroke draws. */}
          <div className="animate-settle-in flex size-16 items-center justify-center rounded-full bg-success-bg">
            <svg
              viewBox="0 0 24 24"
              className="size-8"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path
                className="animate-draw-check text-success"
                d="M4 12.5l5 5L20 7"
              />
            </svg>
          </div>
          <h2 className="text-heading-lg text-text-primary">
            {t("success.heading")}
          </h2>
          <p className="max-w-md text-body-md text-text-secondary">
            {t("success.body", { providerName })}
          </p>
          {providerZaloUrl ? (
            <div className="flex max-w-lg flex-col items-center gap-3 rounded-[var(--fg-radius-lg)] border border-info/25 bg-info-bg px-5 py-4">
              <p className="text-body-sm text-text-secondary">
                {t("success.zaloNote", { providerName })}
              </p>
              <Button
                variant="accent"
                nativeButton={false}
                render={
                  <a
                    href={providerZaloUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <MessageCircle className="size-4" />
                {t("success.openZalo")}
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant={providerZaloUrl ? "outline" : "accent"}
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

  const locationLabel: Record<LocationType, string> = {
    PROVIDER: t("stepDetails.locationProvider"),
    CUSTOMER: t("stepDetails.locationCustomer"),
    OUTDOOR: t("stepDetails.locationOutdoor"),
  };
  const dateLabel = draft.date
    ? formatDate(`${draft.date}T00:00:00+07:00`)
    : null;
  const summaryRows: BookingSummaryRow[] = [
    {
      label: t("flow.rows.package"),
      value: isCustom
        ? draft.customRequest
          ? t("flow.custom.title")
          : null
        : (selectedService?.name ?? null),
      onEdit: () => goTo(0),
    },
    { label: t("flow.rows.date"), value: dateLabel, onEdit: () => goTo(1) },
    {
      label: t("flow.rows.time"),
      value: draft.time,
      sub:
        draft.time && slots.find((s) => s.start === draft.time)?.golden
          ? t("flow.goldenHour")
          : undefined,
      onEdit: () => goTo(2),
    },
    {
      label: t("flow.rows.location"),
      value: draft.locationType
        ? draft.locationType !== "PROVIDER" && draft.locationAddress
          ? draft.locationAddress
          : locationLabel[draft.locationType]
        : null,
      onEdit: () => goTo(3),
    },
    {
      label: t("flow.rows.references"),
      value:
        draft.referenceMedia.length > 0
          ? t("flow.referenceCount", { count: draft.referenceMedia.length })
          : draft.notes
            ? t("flow.hasNotes")
            : null,
      onEdit: () => goTo(4),
    },
  ];
  const total =
    !isCustom && selectedService
      ? formatCurrency(selectedService.price, selectedService.currency)
      : null;

  const stepNames = STEPS.map((key) => t(`flow.steps.${key}`));
  const current = STEPS[step];

  return (
    <>
      {/* Focused header (Core MVP pass, 02/10/2026): leave, who you are
          booking, whether the draft is saved; then every step by name. */}
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-page/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-4 sm:px-8">
          <button
            type="button"
            onClick={() => {
              writeStoredDraft(storageKey, draft);
              router.push(profileHref);
            }}
            className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--fg-radius-sm)] px-1 text-body-md font-semibold text-text-primary"
          >
            <X aria-hidden className="size-5" />
            {t("flow.exit")}
          </button>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-meta text-text-tertiary">
              {t("flow.bookingWith")}
            </span>
            <span className="truncate text-body-md font-semibold text-text-primary">
              {providerName}
            </span>
          </div>
          <span
            role="status"
            className="shrink-0 text-body-sm text-text-secondary"
          >
            {savedAt ? (
              <>
                <span className="max-sm:hidden">
                  {t("flow.savedAt", { time: VN_CLOCK.format(savedAt) })}
                </span>
                <span className="sm:hidden">✓ {VN_CLOCK.format(savedAt)}</span>
              </>
            ) : (
              t("flow.autosaves")
            )}
          </span>
        </div>
        <div className="mx-auto max-w-[1280px] px-4 pb-2 sm:px-8">
          <StepProgress
            label={t("flow.progressLabel")}
            steps={stepNames}
            current={step}
            onStepClick={goTo}
            statusLabels={{
              done: t("flow.stepDone"),
              current: t("flow.stepCurrent"),
              todo: t("flow.stepTodo"),
            }}
          />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1280px] px-5 pt-6 pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-8">
        {fmapContext ? (
          <div className="mt-6 rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-sunken px-4 py-3 text-body-sm text-text-secondary">
            {fmapContext.date && fmapContext.start && fmapContext.end
              ? t("fmapContext.banner", {
                  date: formatDate(`${fmapContext.date}T00:00:00.000Z`),
                  start: fmapContext.start,
                  end: fmapContext.end,
                })
              : t("fmapContext.bannerShort")}
            {fmapCategoryLabel ? ` · ${fmapCategoryLabel}` : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            <div
              key={step}
              className={cn(
                "flex flex-col gap-5",
                direction === "next"
                  ? "animate-step-next"
                  : "animate-step-back",
              )}
            >
              <div className="flex flex-col gap-1.5">
                <span className="text-body-sm text-text-tertiary">
                  {t("flow.stepOf", { n: step + 1, total: STEPS.length })}
                </span>
                <h1
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="text-heading-xl text-text-primary outline-none"
                >
                  {t(`flow.headings.${current}`)}
                </h1>
                <p className="text-body-md text-text-secondary">
                  {t(`flow.subs.${current}`, { providerName })}
                </p>
              </div>

              {current === "package" ? (
                <ChoiceCardGroup legend={t("flow.headings.package")} hideLegend>
                  {services.map((service) => (
                    <ChoiceCard
                      key={service.id}
                      name="package"
                      value={service.id}
                      selected={!isCustom && draft.serviceId === service.id}
                      onSelect={(id) =>
                        setDraft((prev) => ({
                          ...prev,
                          serviceId: id,
                          custom: false,
                        }))
                      }
                      title={service.name}
                      description={
                        [
                          service.editedPhotoCount != null
                            ? t("flow.editedPhotos", {
                                count: service.editedPhotoCount,
                              })
                            : null,
                          service.deliveryDays != null
                            ? t("flow.deliveryDays", {
                                count: service.deliveryDays,
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                      meta={
                        service.description
                          ? service.description.split("\n")[0]
                          : undefined
                      }
                      price={formatCurrency(service.price, service.currency)}
                    />
                  ))}
                  <ChoiceCard
                    name="package"
                    value="__custom__"
                    selected={isCustom}
                    onSelect={() =>
                      setDraft((prev) => ({
                        ...prev,
                        custom: true,
                        serviceId: null,
                      }))
                    }
                    title={t("flow.custom.title")}
                    description={t("flow.custom.description")}
                    price={t("flow.custom.price")}
                  />
                  {isCustom ? (
                    <Textarea
                      label={t("stepService.describeLabel")}
                      rows={4}
                      maxLength={1000}
                      showCount
                      value={draft.customRequest}
                      onChange={(e) => update("customRequest", e.target.value)}
                      placeholder={t("stepService.describePlaceholder")}
                    />
                  ) : null}
                </ChoiceCardGroup>
              ) : null}

              {current === "date" ? (
                <div className="flex flex-col gap-3">
                  <AvailabilityCalendar
                    month={monthCursor}
                    days={toCalendarDays(days, today)}
                    selected={draft.date}
                    loading={daysLoading}
                    canGoBack={!atCurrentMonth}
                    onMonthChange={(delta) =>
                      setMonthCursor(
                        (prev) =>
                          new Date(
                            prev.getFullYear(),
                            prev.getMonth() + delta,
                            1,
                          ),
                      )
                    }
                    onSelect={(date) =>
                      setDraft((prev) => ({
                        ...prev,
                        date,
                        time: prev.date === date ? prev.time : null,
                      }))
                    }
                    emptyMessage={t("flow.noDaysThisMonth")}
                  />
                  {daysError ? (
                    <p role="alert" className="text-body-sm text-danger">
                      {t("flow.availabilityError")}
                    </p>
                  ) : null}
                  <p className="text-meta text-text-tertiary">
                    {t("stepDateTime.localTimeNote")}
                  </p>
                </div>
              ) : null}

              {current === "time" ? (
                <div className="flex flex-col gap-4">
                  {draft.date ? (
                    <div className="flex items-center justify-between gap-3 rounded-[var(--fg-radius-md)] bg-bg-sunken px-4 py-3">
                      <span className="text-body-sm font-semibold! text-text-primary">
                        {formatDateLong(`${draft.date}T00:00:00.000Z`)}
                      </span>
                      <button
                        type="button"
                        onClick={() => goTo(1)}
                        className="focus-ring rounded-[4px] text-body-sm font-semibold! text-text-link underline underline-offset-4"
                      >
                        {t("flow.changeDate")}
                      </button>
                    </div>
                  ) : null}
                  {sun && slots.length > 0 && !daysLoading ? (
                    <SunArc
                      sun={sun}
                      slots={slots}
                      selected={draft.time}
                      onSelect={(time) => update("time", time)}
                    />
                  ) : null}
                  <TimeSlotGrid
                    slots={slots}
                    selected={draft.time}
                    onSelect={(time) => update("time", time)}
                    timezoneLabel={t("flow.timezone")}
                    loading={daysLoading}
                    emptyMessage={t("stepDateTime.noAvailability")}
                  />
                </div>
              ) : null}

              {current === "location" ? (
                <div className="flex flex-col gap-5">
                  {isModel ? <ModelSafetyNotice /> : null}
                  <ChoiceCardGroup
                    legend={t("stepDetails.locationLabel")}
                    hideLegend
                  >
                    {(["PROVIDER", "CUSTOMER", "OUTDOOR"] as const).map(
                      (type) => (
                        <ChoiceCard
                          key={type}
                          name="locationType"
                          value={type}
                          selected={draft.locationType === type}
                          onSelect={() => update("locationType", type)}
                          title={locationLabel[type]}
                          description={t(`flow.locationHints.${type}`)}
                        />
                      ),
                    )}
                  </ChoiceCardGroup>
                  {draft.locationType === "CUSTOMER" ||
                  draft.locationType === "OUTDOOR" ? (
                    <Input
                      label={t("stepDetails.addressLabel")}
                      value={draft.locationAddress}
                      onChange={(e) =>
                        update("locationAddress", e.target.value)
                      }
                      placeholder={t("stepDetails.addressPlaceholder")}
                    />
                  ) : null}
                  <Input
                    label={t("stepDetails.numberOfPeopleLabel")}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder={t("stepDetails.numberOfPeoplePlaceholder")}
                    value={draft.numberOfPeople}
                    onChange={(e) => update("numberOfPeople", e.target.value)}
                  />
                  {requesterCrewRole && parentBookingOptions.length > 0 ? (
                    <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle p-4">
                      <Checkbox
                        checked={parentBookingId !== null}
                        onCheckedChange={(checked) =>
                          setParentBookingId(
                            checked === true
                              ? parentBookingOptions[0].id
                              : null,
                          )
                        }
                        label={t("stepDetails.attachToJob")}
                      />
                      {parentBookingId !== null ? (
                        <NativeSelect
                          label={t("stepDetails.clientJobLabel")}
                          value={parentBookingId}
                          onChange={(v) => setParentBookingId(v)}
                          options={parentBookingOptions.map((option) => ({
                            value: option.id,
                            label: `${formatDayMonth(option.date)} ${option.startTime} — ${option.service?.name ?? t("stepDetails.customRequestOption")}`,
                          }))}
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {isModel ? (
                    <div className="flex flex-col gap-3 rounded-[var(--fg-radius-md)] border border-border-subtle p-4">
                      <span className="text-meta tracking-[0.12em] text-text-tertiary uppercase">
                        {t("stepDetails.shootDetails")}
                      </span>
                      <NativeSelect
                        label={t("stepDetails.shootTypeLabel")}
                        value={draft.shootType}
                        onChange={(v) => update("shootType", v)}
                        options={SHOOT_TYPE_OPTION_KEYS.map((option) => ({
                          value: option.value,
                          label: t(option.key),
                        }))}
                      />
                      <Input
                        label={t("stepDetails.usageRightsLabel")}
                        placeholder={t("stepDetails.usageRightsPlaceholder")}
                        value={draft.usageRights}
                        onChange={(e) => update("usageRights", e.target.value)}
                      />
                      <Textarea
                        label={t("stepDetails.wardrobeLabel")}
                        rows={2}
                        value={draft.wardrobeNotes}
                        onChange={(e) =>
                          update("wardrobeNotes", e.target.value)
                        }
                        placeholder={t("stepDetails.wardrobePlaceholder")}
                      />
                      <Checkbox
                        checked={draft.muaProvided}
                        onCheckedChange={(checked) =>
                          update("muaProvided", checked === true)
                        }
                        label={t("stepDetails.muaProvidedLabel")}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {current === "notes" ? (
                <div className="flex flex-col gap-5">
                  <Textarea
                    label={t("stepDetails.notesLabel")}
                    rows={4}
                    maxLength={1000}
                    showCount
                    value={draft.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder={t("stepDetails.notesPlaceholder")}
                  />
                  {/* Showing the look is faster and far less ambiguous than
                    describing it. */}
                  <ReferenceMediaField
                    purpose="booking"
                    max={MAX_REFERENCE_MEDIA}
                    value={draft.referenceMedia}
                    onChange={(next) => update("referenceMedia", next)}
                  />
                  <Input
                    label={t("stepDetails.contactPhoneLabel")}
                    type="tel"
                    autoComplete="tel"
                    required
                    value={draft.contactPhone}
                    onChange={(e) => update("contactPhone", e.target.value)}
                  />
                </div>
              ) : null}

              {current === "review" ? (
                <div className="flex flex-col gap-5">
                  {/* The summary column is the review on a desktop; phones
                    get it here, since the column sits below the fold. */}
                  <div className="lg:hidden">
                    <BookingSummary
                      provider={{
                        name: providerName,
                        avatarUrl: providerAvatar,
                        rating: providerRating,
                        reviewCount: providerReviewCount,
                        verified: providerVerified,
                      }}
                      rows={summaryRows}
                      total={total}
                      totalNote={t("flow.totalNote")}
                      responseNote={responseNote}
                    />
                  </div>
                  {draft.notes ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-body-sm text-text-tertiary">
                        {t("stepReview.notesLabel")}
                      </span>
                      <p className="text-body-md whitespace-pre-line text-text-primary">
                        {draft.notes}
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-[var(--fg-radius-md)] bg-bg-sunken p-4 text-body-sm text-text-secondary">
                    {t("stepReview.cancellationNotice")}
                  </div>
                  <Checkbox
                    checked={draft.agreed}
                    onCheckedChange={(checked) =>
                      update("agreed", checked === true)
                    }
                    label={t.rich("stepReview.agreeTerms", {
                      terms: termsChunk,
                    })}
                  />
                </div>
              ) : null}

              {submitError ? (
                <div
                  role="alert"
                  className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger"
                >
                  {submitError}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="hidden flex-col gap-4 lg:sticky lg:top-[132px] lg:flex">
            <BookingVisual
              step={step}
              stepName={stepNames[step]}
              photos={providerPhotos}
              sun={sun}
              time={draft.time}
              showSky={current === "time"}
            />
            <BookingSummary
              provider={{
                name: providerName,
                avatarUrl: providerAvatar,
                rating: providerRating,
                reviewCount: providerReviewCount,
                verified: providerVerified,
              }}
              rows={summaryRows}
              total={total}
              totalNote={t("flow.totalNote")}
              responseNote={responseNote}
            />
          </aside>
        </div>
      </div>

      {/* Fixed bottom bar: back and continue, always in reach. A blocked
          Continue stays focusable (aria-disabled) and says why on its own
          label rather than greying out with no reason. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-8">
          {step === 0 ? (
            <Button
              variant="outline"
              className="min-h-12"
              nativeButton={false}
              render={<Link href={profileHref} />}
            >
              <ChevronLeft aria-hidden className="size-4" />
              {t("flow.backToProfileShort")}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="min-h-12"
              onClick={() => goTo(step - 1)}
            >
              <ChevronLeft aria-hidden className="size-4" />
              {t("back")}
            </Button>
          )}
          <span id="continue-reason" className="sr-only">
            {canContinue ? "" : (missingHint ?? "")}
          </span>
          {step < REVIEW ? (
            <Button
              variant="accent"
              size="lg"
              className="min-h-12 max-w-[60%] truncate"
              aria-disabled={!canContinue}
              aria-describedby={canContinue ? undefined : "continue-reason"}
              onClick={() => {
                if (canContinue) goTo(step + 1);
              }}
            >
              {canContinue
                ? t("continueBtn")
                : (missingHint ?? t("continueBtn"))}
              {canContinue ? (
                <ChevronRight aria-hidden className="size-4" />
              ) : null}
            </Button>
          ) : (
            <Button
              variant="accent"
              size="lg"
              className="min-h-12 max-w-[60%] truncate"
              aria-disabled={!canContinue || submitting}
              aria-describedby={canContinue ? undefined : "continue-reason"}
              onClick={() => {
                if (canContinue && !submitting) void onSubmit();
              }}
            >
              {submitting ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              {canContinue ? t("submitBtn") : (missingHint ?? t("submitBtn"))}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
