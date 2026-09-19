"use client";

import type { ProfileCategory } from "@prisma/client";
import {
  ChevronDown,
  LocateFixed,
  Search,
  SlidersHorizontal,
} from "lucide-react";
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

  const categoryOptions = CATEGORIES_BY_ROLE[value.role] ?? [];
  const searchDisabled = isLoading || invalidReason != null;
  const sectionTitle =
    "text-caption-upper tracking-[0.08em] text-text-tertiary sm:col-span-2 lg:col-span-12";

  return (
    <div
      id="fmap-filters"
      className="rounded-[var(--fg-radius-xl)] border border-border-default bg-bg-surface p-3 shadow-[var(--shadow-lg)] sm:p-4"
    >
      {/* Phones: one summary line; the full form opens on demand so the map
          stays above the fold. */}
      <div className="flex items-center gap-2 sm:hidden">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => onExpandedChange(!expanded)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[var(--fg-radius-md)] border border-border-default px-3 py-2.5 text-left text-body-sm text-text-primary"
        >
          <SlidersHorizontal className="size-4 shrink-0" />
          <span className="truncate">
            {t("filters.summary", {
              date: value.date
                ? formatDate(`${value.date}T00:00:00.000Z`)
                : "—",
              start: value.start,
              end: value.end,
              role: roleT(value.role),
            })}
          </span>
          <ChevronDown
            className={cn(
              "ml-auto size-4 shrink-0 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        <Button
          type="button"
          size="icon-sm"
          aria-label={t("filters.search")}
          disabled={searchDisabled}
          onClick={onSearch}
        >
          <Search />
        </Button>
      </div>

      <div
        className={cn(
          expanded ? "mt-3 grid" : "hidden",
          "grid-cols-1 gap-3 sm:mt-0 sm:grid sm:grid-cols-2 lg:grid-cols-12 lg:items-end",
        )}
      >
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
            disabled={!value.provinceId}
            options={[
              {
                value: "",
                label: value.provinceId
                  ? t("filters.allWards")
                  : t("filters.wardNeedsProvince"),
              },
              ...wards.map((ward) => ({ value: ward.id, label: ward.name })),
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
        <div className="sm:col-span-2 lg:col-span-3">
          <DateField
            label={t("filters.date")}
            min={today}
            value={value.date}
            onChange={(date) => onChange({ ...value, date })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3">
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
        <div className="lg:col-span-2">
          <NativeSelect
            label={t("filters.role")}
            value={value.role}
            options={FMAP_PROVIDER_ROLES.map((role) => ({
              value: role,
              label: roleT(role),
            }))}
            onChange={(role) =>
              onChange({
                ...value,
                role: role as FmapFilterValue["role"],
                category: "",
              })
            }
          />
        </div>
        <div className="lg:col-span-2">
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
        <Button
          type="button"
          className="h-[46px] sm:col-span-2 lg:col-span-2"
          disabled={searchDisabled}
          onClick={onSearch}
        >
          <Search />
          {isLoading ? t("filters.searching") : t("filters.search")}
        </Button>
      </div>

      {invalidReason ? (
        <p role="alert" className="mt-2 text-body-sm text-danger">
          {invalidReason}
        </p>
      ) : (
        <p className="mt-2 hidden text-body-sm text-text-tertiary sm:block">
          {t("filters.mapHint")}
        </p>
      )}
    </div>
  );
}
