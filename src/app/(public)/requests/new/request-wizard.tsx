"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ReferenceMediaField } from "@/components/forms/reference-media-field";
import { PhoneVerifyDialog } from "@/components/modals/phone-verify-dialog";
import {
  CallSheet,
  type CallSheetData,
  type CallSheetKey,
} from "@/components/requests/call-sheet";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES_BY_ROLE, PROVIDER_ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { wardsApiPath } from "@/lib/geography-client";
import { mediaKindFromUrl } from "@/lib/media/kind";
import { cn, formatBudgetRange } from "@/lib/utils";
import { MAX_REFERENCE_MEDIA } from "@/lib/validations/reference-media";
import { vietnamDateKey } from "@/lib/vietnam/date";

// Đăng yêu cầu, one question per screen (wave 2, Đặt lịch F). Six questions
// map onto the existing ServiceRequest fields - nothing new is stored:
//   01 need   → role + categories (and a suggested title)
//   02 when   → shootDate + isDateFlexible/dateRange ("± 3 ngày" and "trong
//               tháng" become the range the old form asked for by hand)
//   03 where  → province, ward, area note, private address
//   04 style  → reference photos the customer uploads (optional)
//   05 budget → budgetMin/budgetMax from a preset range, or typed in
//   06 note   → title + description
// The draft saves itself after every change: on this device until it has a
// server draft, then to that draft. The design's time-of-day chips are left
// out - there is no field for them, and a note can say it.

const MAX_CATEGORIES = 5;
const KEYS = "ABCDEF";
const QUESTIONS: CallSheetKey[] = [
  "need",
  "when",
  "where",
  "style",
  "budget",
  "note",
];

type Flex = "" | "exact" | "3d" | "month" | "range";
type Budget = "" | "lt1" | "1-3" | "3-5" | "5-10" | "gt10" | "ask" | "custom";

const BUDGETS: {
  key: Exclude<Budget, "" | "custom">;
  min?: number;
  max?: number;
}[] = [
  { key: "lt1", max: 1_000_000 },
  { key: "1-3", min: 1_000_000, max: 3_000_000 },
  { key: "3-5", min: 3_000_000, max: 5_000_000 },
  { key: "5-10", min: 5_000_000, max: 10_000_000 },
  { key: "gt10", min: 10_000_000 },
  { key: "ask" },
];

interface DraftShape {
  id: string;
  title: string;
  description: string | null;
  role: Role;
  categories: ProfileCategory[];
  shootDate: string | null;
  isDateFlexible: boolean;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  provinceId: string;
  wardId: string | null;
  areaNote: string | null;
  detailedAddress: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  references: { mediaUrl: string; publicId: string }[];
}

interface RequestWizardProps {
  userId: string;
  phoneVerified: boolean;
  phone: string | null;
  provinces: { id: string; code: string; name: string }[];
  draft: DraftShape | null;
}

interface FormState {
  role: Role | "";
  categories: ProfileCategory[];
  date: string;
  flex: Flex;
  /** Only for drafts saved by the old form with a hand-picked range. */
  rangeStart: string;
  rangeEnd: string;
  provinceId: string;
  wardId: string;
  areaNote: string;
  detailedAddress: string;
  references: { mediaUrl: string; publicId: string }[];
  budget: Budget;
  budgetMin: string;
  budgetMax: string;
  title: string;
  /** Once the customer types a title, stop suggesting one. */
  titleEdited: boolean;
  description: string;
}

const EMPTY: FormState = {
  role: "",
  categories: [],
  date: "",
  flex: "",
  rangeStart: "",
  rangeEnd: "",
  provinceId: "",
  wardId: "",
  areaNote: "",
  detailedAddress: "",
  references: [],
  budget: "",
  budgetMin: "",
  budgetMax: "",
  title: "",
  titleEdited: false,
  description: "",
};

function addDays(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthBounds(key: string) {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, "0")}`];
}

/** The range a flexibility choice stands for, never starting in the past. */
function rangeFor(form: FormState, today: string): [string, string] | null {
  if (form.flex === "range") return [form.rangeStart, form.rangeEnd];
  if (!form.date) return null;
  if (form.flex === "3d") {
    const start = addDays(form.date, -3);
    return [start < today ? today : start, addDays(form.date, 3)];
  }
  if (form.flex === "month") {
    const [start, end] = monthBounds(form.date);
    return [start < today ? today : start, end];
  }
  return null;
}

function draftToForm(draft: DraftShape, today: string): FormState {
  const preset = BUDGETS.find(
    (b) =>
      b.key !== "ask" &&
      (b.min ?? null) === draft.budgetMin &&
      (b.max ?? null) === draft.budgetMax,
  );
  const form: FormState = {
    ...EMPTY,
    role: draft.role,
    categories: draft.categories,
    date: draft.shootDate ?? "",
    flex: draft.isDateFlexible ? "range" : draft.shootDate ? "exact" : "",
    rangeStart: draft.dateRangeStart ?? "",
    rangeEnd: draft.dateRangeEnd ?? "",
    provinceId: draft.provinceId,
    wardId: draft.wardId ?? "",
    areaNote: draft.areaNote ?? "",
    detailedAddress: draft.detailedAddress ?? "",
    references: draft.references,
    budget: preset
      ? preset.key
      : draft.budgetMin || draft.budgetMax
        ? "custom"
        : "",
    budgetMin: draft.budgetMin?.toString() ?? "",
    budgetMax: draft.budgetMax?.toString() ?? "",
    title: draft.title,
    titleEdited: true,
    description: draft.description ?? "",
  };
  // A range that is exactly what "± 3 ngày" / "trong tháng" would give
  // reads back as that choice.
  if (form.flex === "range" && form.date) {
    for (const flex of ["3d", "month"] as const) {
      const range = rangeFor({ ...form, flex }, today);
      if (range?.[0] === form.rangeStart && range?.[1] === form.rangeEnd) {
        form.flex = flex;
      }
    }
  }
  return form;
}

interface StoredDraft {
  form: FormState;
  step: number;
  savedAt: string;
}

const VN_TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function RequestWizard({
  userId,
  phoneVerified,
  phone,
  provinces,
  draft,
}: RequestWizardProps) {
  const t = useTranslations("dashboardCore.requestCompose");
  const tw = useTranslations("dashboardCore.requestWizard");
  const tService = useTranslations("publicPages.requestsF.service");
  const tCategory = useTranslations("profileCategory");

  const today = useMemo(() => vietnamDateKey(), []);
  const storageKey = `fg:request-draft:${userId}`;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() =>
    draft ? draftToForm(draft, today) : EMPTY,
  );
  const [requestId, setRequestId] = useState(draft?.id || null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [stored, setStored] = useState<StoredDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [posted, setPosted] = useState<{ id: string; code: string } | null>(
    null,
  );
  const [isVerifiedNow, setIsVerifiedNow] = useState(phoneVerified);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [wards, setWards] = useState<{ id: string; name: string }[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const dirty = useRef(false);

  // A draft kept on this device from an earlier visit is offered, not
  // forced: "Tiếp tục" or "Bắt đầu lại".
  useEffect(() => {
    if (draft) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) startTransition(() => setStored(JSON.parse(raw) as StoredDraft));
    } catch {
      // No storage: nothing to resume.
    }
  }, [draft, storageKey]);

  useEffect(() => {
    const province = provinces.find((p) => p.id === form.provinceId);
    if (!province) {
      startTransition(() => setWards([]));
      return;
    }
    fetch(wardsApiPath(province.code))
      .then((res) => res.json())
      .then((body) => startTransition(() => setWards(body.data ?? [])))
      .catch(() => startTransition(() => setWards([])));
  }, [form.provinceId, provinces]);

  // Focus moves to the question itself on every step change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step, posted]);

  const roleLabel = form.role ? tService(form.role as "PHOTOGRAPHER") : "";
  const suggestedTitle = [
    roleLabel,
    form.categories.map((c) => tCategory(c)).join(", "),
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 120);
  const title = form.titleEdited ? form.title : suggestedTitle;

  const budgetRange = (() => {
    if (form.budget === "custom")
      return {
        min: form.budgetMin ? Number(form.budgetMin) : undefined,
        max: form.budgetMax ? Number(form.budgetMax) : undefined,
      };
    const preset = BUDGETS.find((b) => b.key === form.budget);
    return { min: preset?.min, max: preset?.max };
  })();

  const buildPayload = useCallback(
    (isDraft: boolean) => {
      const range =
        form.flex && form.flex !== "exact" ? rangeFor(form, today) : null;
      return {
        title,
        description: form.description || undefined,
        role: form.role || undefined,
        categories: form.categories,
        shootDate: form.date || undefined,
        isDateFlexible: Boolean(form.flex) && form.flex !== "exact",
        dateRangeStart: range?.[0] || undefined,
        dateRangeEnd: range?.[1] || undefined,
        provinceId: form.provinceId || undefined,
        wardId: form.wardId || null,
        areaNote: form.areaNote || undefined,
        detailedAddress: form.detailedAddress || undefined,
        budgetMin: budgetRange.min,
        budgetMax: budgetRange.max,
        references: form.references,
        isDraft,
      };
    },
    [form, today, title, budgetRange.min, budgetRange.max],
  );

  const update = (patch: Partial<FormState>) => {
    dirty.current = true;
    setError(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  // Autosave: this device right away, the server draft (if there is one)
  // a moment after typing stops.
  useEffect(() => {
    if (!dirty.current || posted) return;
    const now = new Date();
    if (!requestId) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ form, step, savedAt: now.toISOString() }),
        );
        startTransition(() => setSavedAt(now));
      } catch {
        // Storage full or blocked: the label keeps saying "tự lưu".
      }
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(true)),
      })
        .then((res) => {
          if (res.ok) setSavedAt(new Date());
        })
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [form, step, requestId, storageKey, posted, buildPayload]);

  const checkStep = (index: number): string | null => {
    switch (index) {
      case 0:
        if (!form.role) return t("errors.role");
        if (form.categories.length === 0) return t("errors.categories");
        return null;
      case 1:
        if (form.flex === "range") return null;
        if (!form.date) return t("errors.date");
        if (form.date < today) return t("errors.past");
        if (!form.flex) return t("errors.flex");
        return null;
      case 2:
        return form.provinceId ? null : t("errors.province");
      case 4:
        if (!form.budget) return t("errors.budget");
        if (
          form.budget === "custom" &&
          (!form.budgetMin && !form.budgetMax
            ? true
            : Boolean(
                form.budgetMin &&
                form.budgetMax &&
                Number(form.budgetMin) > Number(form.budgetMax),
              ))
        )
          return t("errors.budgetCustom");
        return null;
      case 5:
        return title.trim().length >= 3 ? null : t("errors.title");
      default:
        return null;
    }
  };

  const submit = async () => {
    if (!isVerifiedNow) {
      setVerifyOpen(true);
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      let res: Response;
      if (requestId) {
        // Save the last edits into the draft, then publish it.
        await fetch(`/api/requests/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(true)),
        });
        res = await fetch(`/api/requests/${requestId}/publish`, {
          method: "POST",
        });
      } else {
        res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(false)),
        });
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(body.message ?? tw("genericError"));
        return;
      }
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Nothing to clear.
      }
      setRequestId(body.data.id);
      setPosted({ id: body.data.id, code: body.data.code ?? "" });
    } catch {
      setSubmitError(t("offline"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const next = () => {
    const problem = checkStep(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else void submit();
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const toggleCategory = (category: ProfileCategory) => {
    const has = form.categories.includes(category);
    if (!has && form.categories.length >= MAX_CATEGORIES) {
      setError(t("errors.maxCategories", { max: MAX_CATEGORIES }));
      return;
    }
    update({
      categories: has
        ? form.categories.filter((c) => c !== category)
        : [...form.categories, category],
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (posted) return;
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    const typing =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      target.isContentEditable;
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !typing &&
      tag !== "BUTTON" &&
      tag !== "A"
    ) {
      e.preventDefault();
      next();
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const index = KEYS.indexOf(e.key.toUpperCase());
    if (index < 0) return;
    if (step === 0 && PROVIDER_ROLES[index]) {
      update({ role: PROVIDER_ROLES[index], categories: [] });
    } else if (step === 4 && BUDGETS[index]) {
      update({ budget: BUDGETS[index].key });
    }
  };

  // On the window, so the keys work before anything on the page has focus.
  const keyHandler = useRef(onKeyDown);
  useEffect(() => {
    keyHandler.current = onKeyDown;
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      // Dialogs (call sheet, phone check) handle their own keys.
      if ((e.target as HTMLElement).closest?.("[role=dialog]")) return;
      keyHandler.current(e);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // --- Call sheet preview ---------------------------------------------------
  const province = provinces.find((p) => p.id === form.provinceId);
  const ward = wards.find((w) => w.id === form.wardId);
  const range =
    form.flex && form.flex !== "exact" ? rangeFor(form, today) : null;
  const imageRefs = form.references.filter(
    (ref) => mediaKindFromUrl(ref.mediaUrl) === "IMAGE",
  );
  const sheet: CallSheetData = {
    need: roleLabel
      ? [roleLabel, form.categories.map((c) => tCategory(c)).join(", ")]
          .filter(Boolean)
          .join(" · ")
      : undefined,
    when:
      form.date || range
        ? [
            form.date ? formatDate(form.date) : null,
            form.flex === "exact"
              ? t("flex.exact")
              : range
                ? t("flex.between", {
                    start: formatDate(range[0]),
                    end: formatDate(range[1]),
                  })
                : null,
          ]
            .filter(Boolean)
            .join("\n")
        : undefined,
    where: province
      ? [ward?.name, province.name, form.areaNote].filter(Boolean).join("\n")
      : undefined,
    style:
      form.references.length > 0
        ? t("refCount", { count: form.references.length })
        : undefined,
    refs: imageRefs.map((ref, i) => ({
      src: ref.mediaUrl,
      alt: t("refAlt", { n: i + 1 }),
    })),
    budget: form.budget
      ? form.budget === "ask"
        ? t("budget.ask")
        : (formatBudgetRange(budgetRange.min, budgetRange.max) ?? undefined)
      : undefined,
    // The suggested title repeats row 01; only a title the customer wrote
    // is worth showing again here.
    note:
      [title !== suggestedTitle ? title : null, form.description]
        .filter(Boolean)
        .join("\n") || undefined,
  };
  const sheetCode = posted?.code || t("draftCode");
  const stamp = posted ? t("stampPosted") : t("stampDraft");

  const savedLabel = savedAt
    ? t("savedAt", { time: VN_TIME.format(savedAt) })
    : t("autosave");

  const optionClass = (on: boolean) =>
    cn(
      "focus-ring flex min-h-14 items-center gap-3 rounded-[var(--fg-radius-md)] border px-4 py-3 text-left text-body-lg transition-colors duration-[var(--fg-dur-150)]",
      on
        ? "border-brand-primary bg-bg-sunken shadow-[inset_0_0_0_1px_var(--brand-primary)]"
        : "border-border-default bg-bg-surface hover:border-border-strong",
    );
  const chipClass = (on: boolean) =>
    cn(
      "focus-ring rounded-full border px-3.5 py-1.5 text-body-sm transition-colors duration-[var(--fg-dur-150)]",
      on
        ? "border-brand-primary bg-brand-primary text-text-on-brand"
        : "border-border-default text-text-primary hover:border-border-strong",
    );
  const kbd = (key: string) => (
    <kbd className="grid size-6 shrink-0 place-items-center rounded-[var(--fg-radius-sm)] border border-border-default font-mono text-meta text-text-tertiary">
      {key}
    </kbd>
  );

  const question = QUESTIONS[step];
  const nextLabel = isSubmitting
    ? t("posting")
    : step === QUESTIONS.length - 1
      ? submitError
        ? t("postAgain")
        : t("post")
      : t("next");

  return (
    <div className="bg-bg-page pb-28 lg:pb-16">
      <div className="sticky top-[72px] z-10 border-b border-border-subtle bg-bg-page">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-5 py-3 sm:px-8">
          <Link
            href="/requests"
            className="focus-ring inline-flex items-center gap-1.5 rounded-[var(--fg-radius-sm)] text-body-sm font-semibold! text-text-secondary hover:text-text-primary"
          >
            <X aria-hidden className="size-4" />
            {t("exit")}
          </Link>
          <span className="text-body-sm font-semibold text-text-tertiary">
            {sheetCode} · {stamp}
          </span>
          <span
            role="status"
            aria-live="polite"
            className="ml-auto text-body-sm text-text-tertiary"
          >
            {posted ? null : savedLabel}
          </span>
        </div>
        <div
          aria-hidden
          className="mx-auto flex max-w-[1280px] gap-1 px-5 pb-3 sm:px-8"
        >
          {QUESTIONS.map((key, i) => (
            <span
              key={key}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-[var(--fg-dur-260)]",
                posted || i < step
                  ? "bg-brand-primary"
                  : i === step
                    ? "bg-gold-400"
                    : "bg-border-default",
              )}
            />
          ))}
        </div>
      </div>

      {stored && !posted ? (
        <div role="status" className="mx-auto max-w-[1280px] px-5 pt-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--fg-radius-md)] bg-info-bg px-4 py-3 text-body-sm text-text-primary">
            <span>
              {t("resume.body", {
                time: `${VN_TIME.format(new Date(stored.savedAt))} ${formatDate(stored.savedAt)}`,
                n: String(stored.step + 1).padStart(2, "0"),
              })}
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setForm(stored.form);
                  setStep(stored.step);
                  setStored(null);
                }}
              >
                {t("resume.continue")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  try {
                    localStorage.removeItem(storageKey);
                  } catch {
                    // Nothing to clear.
                  }
                  setStored(null);
                }}
              >
                {t("resume.restart")}
              </Button>
            </span>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-[1280px] gap-12 px-5 pt-[clamp(28px,5vw,64px)] sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section
          aria-labelledby="rq-question"
          className="flex min-w-0 flex-col gap-8"
        >
          {posted ? (
            <div role="status" className="flex flex-col gap-5">
              <span className="text-body-sm font-semibold text-text-tertiary">
                {t("done.eyebrow")}
              </span>
              <h1
                id="rq-question"
                ref={headingRef}
                tabIndex={-1}
                className="font-display text-[clamp(2rem,4vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-balance text-text-primary outline-none"
              >
                {t("done.title", { code: posted.code })}
              </h1>
              <p className="max-w-xl text-body-lg text-text-secondary">
                {t("done.body")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="accent"
                  size="lg"
                  nativeButton={false}
                  render={<Link href={`/dashboard/requests/${posted.id}`} />}
                >
                  {t("done.view")}
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  nativeButton={false}
                  render={<Link href="/requests" />}
                >
                  {t("done.back")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <span className="text-body-sm font-semibold text-text-tertiary">
                  {t("questionLabel", {
                    n: String(step + 1).padStart(2, "0"),
                  })}
                </span>
                <h1
                  id="rq-question"
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-display text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.025em] text-balance text-text-primary outline-none"
                >
                  {t(`q.${question}.title`)}
                </h1>
                <p className="max-w-xl text-body-lg text-text-secondary">
                  {t(`q.${question}.help`)}
                </p>
              </div>

              {step === 0 ? (
                <div className="flex flex-col gap-6">
                  <div
                    role="group"
                    aria-label={t("q.need.title")}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {PROVIDER_ROLES.map((role, i) => (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={form.role === role}
                        onClick={() => update({ role, categories: [] })}
                        className={optionClass(form.role === role)}
                      >
                        {kbd(KEYS[i])}
                        {tService(role as "PHOTOGRAPHER")}
                      </button>
                    ))}
                  </div>
                  {form.role ? (
                    <div className="flex flex-col gap-3">
                      <span
                        id="rq-occasion"
                        className="text-body-md font-semibold! text-text-primary"
                      >
                        {t("occasion", { max: MAX_CATEGORIES })}
                      </span>
                      <div
                        role="group"
                        aria-labelledby="rq-occasion"
                        className="flex flex-wrap gap-2"
                      >
                        {(CATEGORIES_BY_ROLE[form.role] ?? []).map(
                          (category) => (
                            <button
                              key={category}
                              type="button"
                              aria-pressed={form.categories.includes(category)}
                              onClick={() => toggleCategory(category)}
                              className={chipClass(
                                form.categories.includes(category),
                              )}
                            >
                              {tCategory(category)}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 1 ? (
                <div className="flex flex-col gap-6">
                  {form.flex === "range" && !form.date ? (
                    <p className="text-body-md text-text-secondary">
                      {t("flex.keptRange", {
                        start: form.rangeStart
                          ? formatDate(form.rangeStart)
                          : "—",
                        end: form.rangeEnd ? formatDate(form.rangeEnd) : "—",
                      })}
                    </p>
                  ) : null}
                  <DateField
                    label={t("dateLabel")}
                    value={form.date}
                    min={today}
                    onChange={(date) =>
                      update({
                        date,
                        flex: form.flex === "range" ? "" : form.flex,
                      })
                    }
                    className="max-w-xs"
                  />
                  <div className="flex flex-col gap-3">
                    <span
                      id="rq-flex"
                      className="text-body-md font-semibold! text-text-primary"
                    >
                      {t("flex.label")}
                    </span>
                    <div
                      role="radiogroup"
                      aria-labelledby="rq-flex"
                      className="grid gap-2 sm:grid-cols-3"
                    >
                      {(["exact", "3d", "month"] as const).map((flex) => (
                        <button
                          key={flex}
                          type="button"
                          role="radio"
                          aria-checked={form.flex === flex}
                          onClick={() => update({ flex })}
                          className={optionClass(form.flex === flex)}
                        >
                          <span className="text-body-md">
                            {t(`flex.${flex}`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <NativeSelect
                    label={tw("provinceLabel")}
                    value={form.provinceId}
                    onChange={(value) =>
                      update({ provinceId: value, wardId: "" })
                    }
                    options={[
                      { value: "", label: tw("provincePlaceholder") },
                      ...provinces.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                  <NativeSelect
                    label={tw("wardLabel")}
                    value={form.wardId}
                    onChange={(value) => update({ wardId: value })}
                    disabled={!form.provinceId || wards.length === 0}
                    options={[
                      {
                        value: "",
                        label: !form.provinceId
                          ? t("wardFirst")
                          : wards.length === 0
                            ? tw("wardUnavailable")
                            : tw("wardPlaceholder"),
                      },
                      ...wards.map((w) => ({ value: w.id, label: w.name })),
                    ]}
                  />
                  <Input
                    label={t("spotLabel")}
                    placeholder={t("spotPlaceholder")}
                    value={form.areaNote}
                    maxLength={120}
                    onChange={(e) => update({ areaNote: e.target.value })}
                    className="sm:col-span-2"
                  />
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label
                      htmlFor="rq-address"
                      className="text-body-sm font-semibold! text-text-primary"
                    >
                      {t("addressLabel")}
                    </label>
                    <Textarea
                      id="rq-address"
                      rows={2}
                      value={form.detailedAddress}
                      maxLength={300}
                      onChange={(e) =>
                        update({ detailedAddress: e.target.value })
                      }
                    />
                    <p className="text-body-sm text-text-tertiary">
                      {tw("detailedAddressHint")}
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="flex flex-col gap-3">
                  <ReferenceMediaField
                    purpose="request"
                    max={MAX_REFERENCE_MEDIA}
                    value={form.references.map((ref) => ({
                      url: ref.mediaUrl,
                      publicId: ref.publicId,
                    }))}
                    onChange={(items) =>
                      update({
                        references: items.flatMap((item) =>
                          item.publicId
                            ? [{ mediaUrl: item.url, publicId: item.publicId }]
                            : [],
                        ),
                      })
                    }
                  />
                  <span className="text-body-sm text-text-tertiary">
                    {t("refHint")}
                  </span>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="flex flex-col gap-4">
                  <div
                    role="radiogroup"
                    aria-label={t("q.budget.title")}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {BUDGETS.map((budget, i) => (
                      <button
                        key={budget.key}
                        type="button"
                        role="radio"
                        aria-checked={form.budget === budget.key}
                        onClick={() => update({ budget: budget.key })}
                        className={optionClass(form.budget === budget.key)}
                      >
                        {kbd(KEYS[i])}
                        {budget.key === "ask"
                          ? t("budget.ask")
                          : formatBudgetRange(budget.min, budget.max)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-pressed={form.budget === "custom"}
                    onClick={() => update({ budget: "custom" })}
                    className="focus-ring w-fit rounded-[var(--fg-radius-sm)] text-body-sm font-semibold! text-text-link underline-offset-4 hover:underline"
                  >
                    {t("budget.custom")}
                  </button>
                  {form.budget === "custom" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CurrencyInput
                        label={tw("budgetMinLabel")}
                        value={form.budgetMin}
                        onChange={(digits) => update({ budgetMin: digits })}
                      />
                      <CurrencyInput
                        label={tw("budgetMaxLabel")}
                        value={form.budgetMax}
                        onChange={(digits) => update({ budgetMax: digits })}
                      />
                    </div>
                  ) : null}
                  <span className="text-body-sm text-text-tertiary">
                    {t("budget.hint")}
                  </span>
                </div>
              ) : null}

              {step === 5 ? (
                <div className="flex flex-col gap-4">
                  <Input
                    label={tw("titleLabel")}
                    value={title}
                    maxLength={120}
                    onChange={(e) =>
                      update({ title: e.target.value, titleEdited: true })
                    }
                  />
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="rq-note"
                      className="text-body-sm font-semibold! text-text-primary"
                    >
                      {t("noteLabel")}
                    </label>
                    <Textarea
                      id="rq-note"
                      rows={6}
                      maxLength={2000}
                      placeholder={t("notePlaceholder")}
                      value={form.description}
                      onChange={(e) => update({ description: e.target.value })}
                    />
                    <span className="self-end text-meta text-text-tertiary">
                      {form.description.length}/2000
                    </span>
                  </div>
                  {!isVerifiedNow ? (
                    <p className="rounded-[var(--fg-radius-md)] bg-warning-bg p-3 text-body-sm text-warning">
                      {tw("phoneVerifyRequired")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="text-body-sm text-danger">
                  {error}
                </p>
              ) : null}
              {submitError && step === QUESTIONS.length - 1 ? (
                <div
                  role="alert"
                  className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger"
                >
                  <strong>{t("submitFailed")}</strong> {submitError}
                </div>
              ) : null}

              <div className="hidden items-center gap-3 lg:flex">
                {step > 0 ? (
                  <Button variant="ghost" size="lg" onClick={back}>
                    <ChevronLeft aria-hidden className="size-4" />
                    {t("previous")}
                  </Button>
                ) : null}
                <Button
                  variant="accent"
                  size="lg"
                  onClick={next}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : null}
                  {nextLabel}
                </Button>
                <span className="text-body-sm text-text-tertiary">
                  {t.rich("enterHint", {
                    kbd: (chunks) => (
                      <kbd className="rounded-[var(--fg-radius-sm)] border border-border-default px-1.5 font-mono text-meta">
                        {chunks}
                      </kbd>
                    ),
                  })}
                </span>
              </div>
            </>
          )}
        </section>

        <aside
          aria-label={t("previewLabel")}
          className="hidden flex-col gap-3 lg:flex"
        >
          <span className="text-body-sm font-semibold text-text-tertiary">
            {t("previewLabel")}
          </span>
          <CallSheet
            code={sheetCode}
            stamp={stamp}
            stampTone={posted ? "accent" : "neutral"}
            active={posted ? undefined : question}
            data={sheet}
            className="sticky top-[160px]"
          />
        </aside>
      </div>

      {posted ? null : (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-border-subtle bg-bg-surface px-4 py-3 lg:hidden">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={back}
              aria-label={t("previous")}
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setSheetOpen(true)}>
            {t("sheetButton")}
          </Button>
          <Button
            variant="accent"
            className="ml-auto flex-1"
            onClick={next}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : null}
            {nextLabel}
          </Button>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="lg:hidden">
          <SheetHeader>
            <SheetTitle>{t("previewLabel")}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <CallSheet
              code={sheetCode}
              stamp={stamp}
              active={question}
              data={sheet}
            />
          </div>
        </SheetContent>
      </Sheet>

      <PhoneVerifyDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        phone={phone ?? ""}
        onVerified={() => {
          setIsVerifiedNow(true);
        }}
      />
    </div>
  );
}
