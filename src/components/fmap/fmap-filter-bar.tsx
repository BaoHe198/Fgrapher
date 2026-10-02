"use client";

import type { ProfileCategory } from "@prisma/client";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { ChipRail } from "@/components/browse/chip-rail";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
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
  /** "" is every role on the map. */
  role: "" | (typeof FMAP_PROVIDER_ROLES)[number];
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

/** The roles param for the API: one role, or every role on the map. */
export function fmapRolesParam(role: FmapFilterValue["role"]) {
  return role || FMAP_PROVIDER_ROLES.join(",");
}

interface FmapFilterBarProps {
  value: FmapFilterValue;
  onChange: (next: FmapFilterValue) => void;
  onReset: () => void;
  onUseLocation: () => void;
  isLoading: boolean;
  /** Translated reason the current filters can't be searched, if any. */
  invalidReason: string | null;
  /** Providers found by the latest search, for the sheet's main button. */
  resultCount: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Bản đồ F's search controls (Core MVP pass, 02/10/2026): one compact row -
// "khu vực · ngày giờ" and a Bộ lọc button, both opening the same sheet
// (from the bottom on phones, the right from 768px) - and the role rail
// under it. The map re-searches as filters change, so the sheet's main
// button only closes it, saying how many it found. The badge counts only
// the filters not already on screen (ward, style).
export function FmapFilterBar({
  value,
  onChange,
  onReset,
  onUseLocation,
  isLoading,
  invalidReason,
  resultCount,
  open,
  onOpenChange,
}: FmapFilterBarProps) {
  const t = useTranslations("fmap");
  const v2 = useTranslations("fmap.v2");
  const railT = useTranslations("publicPages.browse.v3.railRoles");
  const isMobile = useIsMobile();
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
      roles: fmapRolesParam(value.role),
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

  const categoryOptions = value.role
    ? (CATEGORIES_BY_ROLE[value.role] ?? [])
    : [];
  const advancedCount = (value.wardId ? 1 : 0) + (value.category ? 1 : 0);
  const sectionTitle = "text-body-sm font-semibold text-text-primary";

  const provinceName = provinces.find((p) => p.id === value.provinceId)?.name;
  const wardName = wards.find((w) => w.id === value.wardId)?.name;
  const placeLabel = wardName
    ? `${wardName}, ${provinceName ?? ""}`
    : (provinceName ?? t("filters.wholeMap"));
  const whenLabel = value.date
    ? `${formatDate(`${value.date}T00:00:00.000Z`).slice(0, 5)}, ${value.start}–${value.end}`
    : "—";

  return (
    <div className="relative z-30 flex flex-col gap-2 border-b border-border-subtle bg-bg-page px-4 pt-2 pb-2 shadow-[var(--shadow-sm)] md:px-6 md:pt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-haspopup="dialog"
          className="focus-ring flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border-default bg-bg-surface px-4 text-left text-body-md md:max-w-[520px]"
        >
          <Search aria-hidden className="size-4 shrink-0 text-text-secondary" />
          <span className="truncate">
            <strong className="font-semibold text-text-primary">
              {placeLabel}
            </strong>
            <span className="text-text-secondary tabular-nums">
              {" · "}
              {whenLabel}
            </span>
          </span>
        </button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(true)}
          aria-haspopup="dialog"
          aria-label={
            isMobile
              ? advancedCount > 0
                ? v2("filtersWithCount", { count: advancedCount })
                : t("filters.more")
              : undefined
          }
          className="relative size-12 shrink-0 rounded-full px-0 md:w-auto md:px-4"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          <span className="max-md:hidden">{t("filters.more")}</span>
          {advancedCount > 0 ? (
            <span
              aria-hidden={isMobile}
              className="grid size-5 place-items-center rounded-full bg-brand-primary text-meta font-semibold text-text-on-brand max-md:absolute max-md:-top-1 max-md:-right-1"
            >
              {advancedCount}
            </span>
          ) : null}
        </Button>
      </div>

      <ChipRail
        label={t("filters.role")}
        moreLabel={v2("moreRoles")}
        value={value.role}
        onPick={(role) =>
          onChange({
            ...value,
            role: role as FmapFilterValue["role"],
            category: "",
          })
        }
        items={[
          { value: "", label: v2("allRoles") },
          ...FMAP_PROVIDER_ROLES.map((role) => ({
            value: role,
            label: railT(role),
          })),
        ]}
      />

      {invalidReason ? (
        <p role="alert" className="text-body-sm text-danger">
          {invalidReason}
        </p>
      ) : null}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col overflow-hidden",
            isMobile ? "max-h-[88dvh]" : "w-[88%] sm:max-w-md",
          )}
        >
          <SheetHeader>
            <SheetTitle>{t("filters.more")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("filters.mapHint")}
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <p className={sectionTitle}>{t("filters.areaTitle")}</p>
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
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={() => {
                onOpenChange(false);
                onUseLocation();
              }}
            >
              <LocateFixed />
              {t("filters.myLocation")}
            </Button>

            <div className="h-px bg-border-subtle" />

            <p className={sectionTitle}>{t("filters.whenTitle")}</p>
            <DateField
              label={t("filters.date")}
              min={today}
              value={value.date}
              onChange={(date) => onChange({ ...value, date })}
            />
            <div className="grid grid-cols-2 gap-2">
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
            {value.role ? (
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
            ) : (
              <p className="text-body-sm text-text-secondary">
                {v2("categoryNeedsRole")}
              </p>
            )}
            {invalidReason ? (
              <p role="alert" className="text-body-sm text-danger">
                {invalidReason}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 border-t border-border-subtle px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onReset}
              className="focus-ring min-h-12 rounded-[var(--fg-radius-sm)] px-2 text-body-md font-semibold text-text-primary underline underline-offset-4"
            >
              {v2("reset")}
            </button>
            <Button
              variant="primary"
              className="h-12 flex-1"
              onClick={() => onOpenChange(false)}
            >
              {isLoading
                ? t("filters.searching")
                : resultCount == null
                  ? t("filters.close")
                  : resultCount > 0
                    ? v2("seeResults", { count: resultCount })
                    : v2("noResults")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
