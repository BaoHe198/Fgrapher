"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  WalletCards,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { PhoneVerifyDialog } from "@/components/modals/phone-verify-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDate } from "@/lib/format";
import { Tag } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";
import { ReferenceMediaField } from "@/components/forms/reference-media-field";
import { toast } from "@/components/ui/toast";
import { CATEGORIES_BY_ROLE, PROVIDER_ROLES } from "@/lib/constants";
import { wardsApiPath } from "@/lib/geography-client";
import { formatBudgetRange } from "@/lib/utils";
import { MAX_REFERENCE_MEDIA } from "@/lib/validations/reference-media";

const MAX_CATEGORIES = 5;

const STEP_KEYS = [
  "who",
  "when",
  "where",
  "budget",
  "concept",
  "review",
] as const;

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
  phoneVerified: boolean;
  phone: string | null;
  provinces: { id: string; code: string; name: string }[];
  draft: DraftShape | null;
}

interface WardOption {
  id: string;
  name: string;
}

interface FormState {
  title: string;
  description: string;
  role: Role | "";
  categories: ProfileCategory[];
  shootDate: string;
  isDateFlexible: boolean;
  dateRangeStart: string;
  dateRangeEnd: string;
  provinceId: string;
  wardId: string;
  areaNote: string;
  detailedAddress: string;
  budgetMin: string;
  budgetMax: string;
  references: { mediaUrl: string; publicId: string }[];
}

function draftToForm(draft: DraftShape | null): FormState {
  if (!draft) {
    return {
      title: "",
      description: "",
      role: "",
      categories: [],
      shootDate: "",
      isDateFlexible: false,
      dateRangeStart: "",
      dateRangeEnd: "",
      provinceId: "",
      wardId: "",
      areaNote: "",
      detailedAddress: "",
      budgetMin: "",
      budgetMax: "",
      references: [],
    };
  }
  return {
    title: draft.title,
    description: draft.description ?? "",
    role: draft.role,
    categories: draft.categories,
    shootDate: draft.shootDate ?? "",
    isDateFlexible: draft.isDateFlexible,
    dateRangeStart: draft.dateRangeStart ?? "",
    dateRangeEnd: draft.dateRangeEnd ?? "",
    provinceId: draft.provinceId,
    wardId: draft.wardId ?? "",
    areaNote: draft.areaNote ?? "",
    detailedAddress: draft.detailedAddress ?? "",
    budgetMin: draft.budgetMin?.toString() ?? "",
    budgetMax: draft.budgetMax?.toString() ?? "",
    references: draft.references,
  };
}

export function RequestWizard({
  phoneVerified,
  phone,
  provinces,
  draft,
}: RequestWizardProps) {
  const t = useTranslations("dashboardCore.requestWizard");
  const roleT = useTranslations("role");
  const categoryT = useTranslations("profileCategory");
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => draftToForm(draft));
  const [requestId, setRequestId] = useState(draft?.id ?? null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifiedNow, setIsVerifiedNow] = useState(phoneVerified);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [wards, setWards] = useState<WardOption[]>([]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Wards are loaded only for the selected province to keep the nationwide
  // dataset out of the initial page payload.
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

  const categoryOptions = form.role
    ? (CATEGORIES_BY_ROLE[form.role] ?? [])
    : [];

  const toggleCategory = (category: ProfileCategory) => {
    setForm((prev) => {
      const has = prev.categories.includes(category);
      if (has) {
        return {
          ...prev,
          categories: prev.categories.filter((c) => c !== category),
        };
      }
      if (prev.categories.length >= MAX_CATEGORIES) return prev;
      return { ...prev, categories: [...prev.categories, category] };
    });
  };

  const buildPayload = (isDraft: boolean) => ({
    title: form.title,
    description: form.description || undefined,
    role: form.role || undefined,
    categories: form.categories,
    shootDate: form.shootDate || undefined,
    isDateFlexible: form.isDateFlexible,
    dateRangeStart: form.dateRangeStart || undefined,
    dateRangeEnd: form.dateRangeEnd || undefined,
    provinceId: form.provinceId || undefined,
    wardId: form.wardId || null,
    areaNote: form.areaNote || undefined,
    detailedAddress: form.detailedAddress || undefined,
    budgetMin: form.budgetMin ? Number(form.budgetMin) : undefined,
    budgetMax: form.budgetMax ? Number(form.budgetMax) : undefined,
    references: form.references,
    isDraft,
  });

  const saveDraft = async () => {
    setError(null);
    setIsSavingDraft(true);
    const res = requestId
      ? await fetch(`/api/requests/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(true)),
        })
      : await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(true)),
        });
    const body = await res.json();
    setIsSavingDraft(false);

    if (!res.ok) {
      setError(body.message ?? t("genericError"));
      return;
    }
    if (!requestId) setRequestId(body.data.id);
    toast.add({ title: t("draftSaved"), type: "success" });
  };

  const submit = async () => {
    if (!isVerifiedNow) {
      setVerifyDialogOpen(true);
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const res = requestId
      ? await fetch(`/api/requests/${requestId}/publish`, { method: "POST" })
      : await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(false)),
        });
    const body = await res.json();
    setIsSubmitting(false);

    if (!res.ok) {
      setError(body.message ?? t("genericError"));
      return;
    }

    toast.add({ title: t("posted"), type: "success" });
    router.push(`/dashboard/requests/${body.data.id}`);
  };

  // Both are optional fields (the app never requires a preferred window
  // or a budget at all — see service-request.ts's schema), so these only
  // ever fire once BOTH sides of a pair are filled in and out of order,
  // never for a merely-incomplete one.
  const dateRangeInvalid = Boolean(
    form.isDateFlexible &&
    form.dateRangeStart &&
    form.dateRangeEnd &&
    form.dateRangeStart > form.dateRangeEnd,
  );
  const budgetInvalid = Boolean(
    form.budgetMin &&
    form.budgetMax &&
    Number(form.budgetMin) > Number(form.budgetMax),
  );

  const canContinue = (() => {
    switch (step) {
      case 0:
        return Boolean(form.role) && form.categories.length > 0;
      case 1:
        return (
          (form.isDateFlexible || Boolean(form.shootDate)) && !dateRangeInvalid
        );
      case 2:
        return Boolean(form.provinceId);
      case 3:
        return !budgetInvalid;
      case 4:
        return form.title.trim().length >= 3;
      default:
        return true;
    }
  })();

  // Why Continue is greyed out — "đã chọn 0/5" read as a limit, not as
  // "pick at least one" (24/09 audit).
  const missingHint = (() => {
    if (canContinue) return null;
    switch (step) {
      case 0:
        return form.role ? t("missingHint.categories") : t("missingHint.role");
      case 1:
        return dateRangeInvalid
          ? t("missingHint.dateRange")
          : t("missingHint.date");
      case 2:
        return t("missingHint.province");
      case 3:
        return t("missingHint.budget");
      case 4:
        return t("missingHint.title");
      default:
        return null;
    }
  })();

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-0">
      <h1 className="mb-1 text-display-md text-text-primary">{t("heading")}</h1>
      <p className="mb-6 text-body-md text-text-secondary">{t("subheading")}</p>
      {/* Said up front, not only on the last step after five screens of
          typing (24/09 audit). */}
      {!isVerifiedNow && step === 0 ? (
        <p className="-mt-3 mb-6 rounded-[var(--fg-radius-md)] bg-info-bg p-3 text-body-sm text-info">
          {t("phoneVerifyHeadsUp")}
        </p>
      ) : null}

      <div className="mb-6 flex items-center gap-1.5">
        {STEP_KEYS.map((key, index) => (
          <div
            key={key}
            className={`h-1.5 flex-1 rounded-full ${
              index <= step ? "bg-brand-primary" : "bg-bg-sunken"
            }`}
          />
        ))}
      </div>

      <Card className="flex flex-col gap-5 p-6">
        <span className="text-body-sm font-semibold! text-text-tertiary">
          {t("stepLabel", { current: step + 1, total: STEP_KEYS.length })} ·{" "}
          {t(`steps.${STEP_KEYS[step]}`)}
        </span>

        {step === 0 ? (
          <div className="flex flex-col gap-4">
            <NativeSelect
              label={t("roleLabel")}
              value={form.role}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  role: value as Role,
                  categories: [],
                }))
              }
              options={[
                { value: "", label: t("rolePlaceholder") },
                ...PROVIDER_ROLES.map((r) => ({ value: r, label: roleT(r) })),
              ]}
            />
            {form.role ? (
              <div className="flex flex-col gap-2">
                <span className="text-body-sm font-semibold! text-text-primary">
                  {t("categoriesLabel", {
                    count: form.categories.length,
                    max: MAX_CATEGORIES,
                  })}
                </span>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((category) => (
                    <Tag
                      key={category}
                      selected={form.categories.includes(category)}
                      onClick={() => toggleCategory(category)}
                    >
                      {categoryT(category)}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <Checkbox
              checked={form.isDateFlexible}
              onCheckedChange={(checked) =>
                update("isDateFlexible", checked === true)
              }
              label={t("isDateFlexibleLabel")}
            />
            {form.isDateFlexible ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DateField
                  label={t("dateRangeStartLabel")}
                  value={form.dateRangeStart}
                  onChange={(value) => update("dateRangeStart", value)}
                  aria-invalid={dateRangeInvalid}
                />
                <DateField
                  label={t("dateRangeEndLabel")}
                  value={form.dateRangeEnd}
                  onChange={(value) => update("dateRangeEnd", value)}
                  error={
                    dateRangeInvalid ? t("dateRangeOrderError") : undefined
                  }
                />
              </div>
            ) : (
              <DateField
                label={t("shootDateLabel")}
                value={form.shootDate}
                onChange={(value) => update("shootDate", value)}
              />
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-4">
            <NativeSelect
              label={t("provinceLabel")}
              value={form.provinceId}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, provinceId: value, wardId: "" }))
              }
              options={[
                { value: "", label: t("provincePlaceholder") },
                ...provinces.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <NativeSelect
              label={t("wardLabel")}
              value={form.wardId}
              onChange={(value) => update("wardId", value)}
              disabled={!form.provinceId || wards.length === 0}
              options={[
                {
                  value: "",
                  label:
                    form.provinceId && wards.length === 0
                      ? t("wardUnavailable")
                      : t("wardPlaceholder"),
                },
                ...wards.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="request-wizard-field-1"
                className="text-body-sm font-semibold! text-text-primary"
              >
                {t("detailedAddressLabel")}
              </label>
              <Textarea
                id="request-wizard-field-1"
                rows={2}
                value={form.detailedAddress}
                maxLength={300}
                onChange={(e) => update("detailedAddress", e.target.value)}
              />
              <p className="text-body-sm text-text-tertiary">
                {t("detailedAddressHint")}
              </p>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CurrencyInput
                label={t("budgetMinLabel")}
                value={form.budgetMin}
                onChange={(digits) => update("budgetMin", digits)}
                aria-invalid={budgetInvalid}
              />
              <CurrencyInput
                label={t("budgetMaxLabel")}
                value={form.budgetMax}
                onChange={(digits) => update("budgetMax", digits)}
                error={budgetInvalid ? t("budgetOrderError") : undefined}
              />
            </div>
            <p className="text-body-sm text-text-tertiary">{t("budgetHint")}</p>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="flex flex-col gap-4">
            <Input
              label={t("titleLabel")}
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="request-wizard-field-2"
                className="text-body-sm font-semibold! text-text-primary"
              >
                {t("descriptionLabel")}
              </label>
              <Textarea
                id="request-wizard-field-2"
                rows={4}
                value={form.description}
                maxLength={2000}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <ReferenceMediaField
              purpose="request"
              max={MAX_REFERENCE_MEDIA}
              value={form.references.map((ref) => ({
                url: ref.mediaUrl,
                publicId: ref.publicId,
              }))}
              onChange={(next) =>
                setForm((prev) => ({
                  ...prev,
                  references: next.flatMap((item) =>
                    item.publicId
                      ? [{ mediaUrl: item.url, publicId: item.publicId }]
                      : [],
                  ),
                }))
              }
            />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="flex flex-col gap-3 text-body-sm">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-text-primary">
                {t("titleLabel")}
              </span>
              <span className="text-text-secondary">{form.title || "—"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-text-primary">
                {t("roleLabel")}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-text-secondary">
                {form.role ? (
                  <Badge variant="accent">{roleT(form.role)}</Badge>
                ) : (
                  "—"
                )}
                {form.categories.map((c) => (
                  <Badge key={c} variant="neutral">
                    {categoryT(c)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-text-primary">
                {t("steps.when")}
              </span>
              <span className="text-text-secondary">
                {form.isDateFlexible
                  ? form.dateRangeStart && form.dateRangeEnd
                    ? t("reviewDateFlexible", {
                        start: formatDate(form.dateRangeStart),
                        end: formatDate(form.dateRangeEnd),
                      })
                    : t("reviewDateFlexibleNoRange")
                  : form.shootDate
                    ? formatDate(form.shootDate)
                    : "—"}
              </span>
            </div>
            <div className="flex gap-2.5 rounded-[var(--fg-radius-md)] bg-info-bg p-3.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-info" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold text-info">
                  {t("steps.where")}
                </span>
                <span className="text-text-primary">
                  {wards.find((w) => w.id === form.wardId)?.name
                    ? `${wards.find((w) => w.id === form.wardId)?.name}, `
                    : ""}
                  {provinces.find((p) => p.id === form.provinceId)?.name ?? "—"}
                  {form.areaNote ? ` — ${form.areaNote}` : ""}
                </span>
              </div>
            </div>
            <div className="flex gap-2.5 rounded-[var(--fg-radius-md)] bg-gold-100 p-3.5 text-gold-800">
              <WalletCards className="mt-0.5 size-4 shrink-0" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">{t("steps.budget")}</span>
                <span className="font-bold!">
                  {/* budgetInvalid should be unreachable here — canContinue
                    blocks leaving step 3 while it's true — but review
                    must never show an inverted range regardless. */}
                  {(form.budgetMin || form.budgetMax) && !budgetInvalid
                    ? formatBudgetRange(
                        form.budgetMin ? Number(form.budgetMin) : null,
                        form.budgetMax ? Number(form.budgetMax) : null,
                      )
                    : t("budgetNotSet")}
                </span>
              </div>
            </div>
            {!isVerifiedNow ? (
              <div className="rounded-[var(--fg-radius-md)] bg-warning-bg p-3 text-warning">
                {t("phoneVerifyRequired")}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      </Card>

      <div className="mt-5 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <ChevronLeft className="size-4" />
          {t("back")}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={isSavingDraft}
            onClick={saveDraft}
          >
            {isSavingDraft ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("saveDraft")}
          </Button>
          {step < STEP_KEYS.length - 1 ? (
            <Button
              variant="accent"
              disabled={!canContinue}
              onClick={() => setStep((s) => s + 1)}
            >
              {t("continue")}
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button variant="accent" disabled={isSubmitting} onClick={submit}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {t("post")}
            </Button>
          )}
        </div>
      </div>
      {missingHint ? (
        <p className="mt-2 text-right text-body-sm text-text-tertiary">
          {missingHint}
        </p>
      ) : null}

      <PhoneVerifyDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        phone={phone ?? ""}
        onVerified={() => {
          setIsVerifiedNow(true);
          toast.add({ title: t("phoneVerifiedToast"), type: "success" });
        }}
      />
    </div>
  );
}
