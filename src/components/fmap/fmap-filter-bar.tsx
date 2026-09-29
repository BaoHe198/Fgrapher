"use client";

import type { ProfileCategory } from "@prisma/client";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { NativeSelect } from "@/components/ui/native-select";
import { CATEGORIES_BY_ROLE } from "@/lib/constants";
import { formatDate, vietnamDateKey } from "@/lib/format";
import { provincesApiPath, wardsApiPath } from "@/lib/geography-client";
import { cn } from "@/lib/utils";
import { FMAP_PROVIDER_ROLES } from "@/lib/validations/fmap";

export type FmapFilterValue = {
  provinceId: string;
  wardId: string;
  date: string;
  start: string;
  end: string;
  role: (typeof FMAP_PROVIDER_ROLES)[number];
  category: "" | ProfileCategory;
};

interface ProvinceOption {
  id: string;
  code: string;
  name: string;
}

interface WardOption {
  id: string;
  name: string;
}

// Half-hour steps as a select rather than <input type="time">: the native
// control renders 12-hour "09:00 AM" on English-locale devices and yields an
// empty value while half-typed, which reached the API as an invalid search.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const time = `${hours}:${index % 2 ? "30" : "00"}`;
  return { value: time, label: time };
});

interface FmapFilterBarProps {
  value: FmapFilterValue;
  onChange: (next: FmapFilterValue) => void;
  onSearch: () => void;
  onUseLocation: () => void;
  isLoading: boolean;
  /** Translated reason the current filters can't be searched, if any. */
  invalidReason: string | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function FmapFilterBar({
  value,
  onChange,
  onSearch,
  onUseLocation,
  isLoading,
  invalidReason,
  expanded,
  onExpandedChange,
}: FmapFilterBarProps) {
  const t = useTranslations("fmap");
  const roleT = useTranslations("role");
  const categoryT = useTranslations("profileCategory");
  const today = vietnamDateKey();
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const [wardCounts, setWardCounts] = useState<Map<string, number> | null>(
    null,
  );

  useEffect(() => {
    fetch(provincesApiPath())
      .then((res) => res.json())
      .then((body) => startTransition(() => setProvinces(body.data ?? [])))
      .catch(() => {});
  }, []);

  const provinceCode =
    provinces.find((province) => province.id === value.provinceId)?.code ?? "";
  useEffect(() => {
    if (!provinceCode) {
      startTransition(() => setWards([]));
      return;
    }
    fetch(wardsApiPath(provinceCode))
      .then((res) => res.json())
      .then((body) => startTransition(() => setWards(body.data ?? [])))
      .catch(() => {});
  }, [provinceCode]);

  // Only wards that currently have providers of the chosen role are
  // offered: most wards have none, and picking one used to leave every
  // later search (time change, pan) stuck on "no providers".
  useEffect(() => {
    if (!value.provinceId) {
      startTransition(() => setWardCounts(null));
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      provinceId: value.provinceId,
      roles: value.role,
    });
    fetch(`/api/fmap/ward-counts?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { data: { wardId: string; count: number }[] | null }) =>
        startTransition(() =>
          setWardCounts(
            new Map((body.data ?? []).map((row) => [row.wardId, row.count])),
          ),
        ),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [value.provinceId, value.role]);

  const wardOptions = wardCounts
    ? wards.filter((ward) => wardCounts.has(ward.id))
    : [];

  // A role change can empty the chosen ward; drop the filter rather than
  // keep searching somewhere with nobody of that role.
  const staleWard =
    value.wardId !== "" && wardCounts !== null && !wardCounts.has(value.wardId);
  useEffect(() => {
    if (staleWard) startTransition(() => onChange({ ...value, wardId: "" }));
  }, [staleWard, onChange, value]);

  const categoryOptions = CATEGORIES_BY_ROLE[value.role] ?? [];
  const searchDisabled = isLoading || invalidReason != null;
  const sectionTitle =
    "text-meta tracking-[0.12em] text-text-tertiary uppercase sm:col-span-2 lg:col-span-12";

  const provinceName = provinces.find((p) => p.id === value.provinceId)?.name;
  const wardName = wards.find((w) => w.id === value.wardId)?.name;
  const placeLabel = wardName
    ? `${wardName}, ${provinceName ?? ""}`
    : (provinceName ?? t("filters.wholeMap"));
  const whenLabel = value.date
    ? `${formatDate(`${value.date}T00:00:00.000Z`)} · ${value.start}–${value.end}`
    : "—";

  return (
    <div id="fmap-filters" className="relative z-30">
      {/* The compact bar (redesign 09/2026): where and when in one pill
          with the search button, the role as chips, and "Bộ lọc" for the
          full form. Both halves of the pill open that form too. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-bg-surface px-4 py-3 md:flex-nowrap md:gap-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-border-strong bg-bg-surface py-1 pr-1 pl-4 shadow-[var(--shadow-sm)] md:w-[500px] md:flex-none">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="fmap-filter-panel"
            onClick={() => onExpandedChange(!expanded)}
            className="focus-ring flex min-w-0 flex-1 flex-col items-start rounded-[var(--fg-radius-sm)] py-1 text-left"
          >
            <span className="text-meta text-text-tertiary">
              {t("filters.areaTitle")}
            </span>
            <span className="w-full truncate text-body-sm font-semibold! text-text-primary">
              {placeLabel}
            </span>
          </button>
          <span
            aria-hidden
            className="mx-3 h-8 w-px shrink-0 bg-border-subtle"
          />
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="fmap-filter-panel"
            onClick={() => onExpandedChange(!expanded)}
            className="focus-ring flex min-w-0 flex-1 flex-col items-start rounded-[var(--fg-radius-sm)] py-1 text-left"
          >
            <span className="text-meta text-text-tertiary">
              {t("filters.whenPill")}
            </span>
            <span className="w-full truncate font-mono text-body-sm font-semibold! text-text-primary tabular-nums">
              {whenLabel}
            </span>
          </button>
          <Button
            type="button"
            size="icon"
            aria-label={t("filters.search")}
            disabled={searchDisabled}
            onClick={onSearch}
            className="ml-2 shrink-0 rounded-full"
          >
            <Search />
          </Button>
        </div>

        <div
          role="group"
          aria-label={t("filters.role")}
          className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:w-auto md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {FMAP_PROVIDER_ROLES.map((role) => {
            const active = value.role === role;
            return (
              <button
                key={role}
                type="button"
                data-interactive="true"
                aria-pressed={active}
                onClick={() => onChange({ ...value, role, category: "" })}
                className={cn(
                  "focus-ring shrink-0 rounded-full border px-3.5 py-2 text-body-sm whitespace-nowrap transition-colors duration-[var(--fg-dur-150)]",
                  active
                    ? "border-brand-primary bg-brand-primary font-semibold! text-text-on-brand"
                    : "border-border-default bg-bg-surface text-text-primary hover:border-border-strong",
                )}
              >
                {roleT(role)}
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          aria-expanded={expanded}
          aria-controls="fmap-filter-panel"
          onClick={() => onExpandedChange(!expanded)}
          className="ml-auto shrink-0 max-md:hidden"
        >
          <SlidersHorizontal />
          {t("filters.more")}
        </Button>
      </div>

      {invalidReason ? (
        <p
          role="alert"
          className="border-b border-border-subtle bg-danger-bg px-4 py-2 text-body-sm text-danger md:px-6"
        >
          {invalidReason}
        </p>
      ) : null}

      {expanded ? (
        <div
          id="fmap-filter-panel"
          className="absolute inset-x-3 top-full mt-2 max-h-[calc(100dvh-180px)] overflow-y-auto rounded-[var(--fg-radius-xl)] border border-border-subtle bg-surface-card p-4 shadow-[var(--shadow-lg)] animate-page-in md:left-6 md:right-auto md:w-[min(960px,calc(100%-3rem))] md:p-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <p className={sectionTitle}>{t("filters.areaTitle")}</p>
            <div className="lg:col-span-4">
              <NativeSelect
                label={t("filters.province")}
                value={value.provinceId}
                options={[
                  { value: "", label: t("filters.chooseProvince") },
                  ...provinces.map((province) => ({
                    value: province.id,
                    label: province.name,
                  })),
                ]}
                onChange={(provinceId) =>
                  onChange({ ...value, provinceId, wardId: "" })
                }
              />
            </div>
            <div className="lg:col-span-4">
              <NativeSelect
                label={t("filters.ward")}
                value={value.wardId}
                disabled={!value.provinceId || wardOptions.length === 0}
                options={[
                  {
                    value: "",
                    label: !value.provinceId
                      ? t("filters.wardNeedsProvince")
                      : wardCounts && wardOptions.length === 0
                        ? t("filters.noWardsWithProviders")
                        : t("filters.allWards"),
                  },
                  ...wardOptions.map((ward) => ({
                    value: ward.id,
                    label: t("filters.wardOption", {
                      name: ward.name,
                      count: wardCounts?.get(ward.id) ?? 0,
                    }),
                  })),
                ]}
                onChange={(wardId) => onChange({ ...value, wardId })}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onUseLocation}
              className="h-[46px] sm:col-span-2 lg:col-span-4"
            >
              <LocateFixed />
              {t("filters.myLocation")}
            </Button>

            <div className="my-1 h-px bg-border-subtle sm:col-span-2 lg:col-span-12" />

            <p className={sectionTitle}>{t("filters.whenTitle")}</p>
            <div className="sm:col-span-2 lg:col-span-4">
              <DateField
                label={t("filters.date")}
                min={today}
                value={value.date}
                onChange={(date) => onChange({ ...value, date })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-4">
              <NativeSelect
                label={t("filters.start")}
                value={value.start}
                options={TIME_OPTIONS}
                onChange={(start) => onChange({ ...value, start })}
              />
              <NativeSelect
                label={t("filters.end")}
                value={value.end}
                options={TIME_OPTIONS}
                onChange={(end) => onChange({ ...value, end })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <NativeSelect
                label={t("filters.category")}
                value={value.category}
                options={[
                  { value: "", label: t("filters.allCategories") },
                  ...categoryOptions.map((category) => ({
                    value: category,
                    label: categoryT(category),
                  })),
                ]}
                onChange={(category) =>
                  onChange({
                    ...value,
                    category: category as FmapFilterValue["category"],
                  })
                }
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <p className="text-meta text-text-tertiary">
              {t("filters.mapHint")}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onExpandedChange(false)}
              >
                {t("filters.close")}
              </Button>
              <Button
                type="button"
                disabled={searchDisabled}
                onClick={onSearch}
              >
                <Search />
                {isLoading ? t("filters.searching") : t("filters.search")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
