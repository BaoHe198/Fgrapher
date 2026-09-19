"use client";

import type { ProfileCategory } from "@prisma/client";
import {
  LocateFixed,
  Search,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FMAP_PROVIDER_ROLES } from "@/lib/validations/fmap";
import { provincesApiPath } from "@/lib/geography-client";
import { CATEGORIES_BY_ROLE } from "@/lib/constants";
import { formatDate, vietnamDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FmapFilterValue = {
  date: string;
  start: string;
  end: string;
  role: (typeof FMAP_PROVIDER_ROLES)[number];
  category: "" | ProfileCategory;
};

export function FmapFilterBar({
  value,
  onChange,
  onSearch,
  onUseLocation,
  isLoading,
  provinceId,
  onProvinceChange,
  expanded,
  onExpandedChange,
}: {
  value: FmapFilterValue;
  onChange: (next: FmapFilterValue) => void;
  onSearch: () => void;
  onUseLocation: () => void;
  isLoading: boolean;
  provinceId: string;
  onProvinceChange: (provinceId: string) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const t = useTranslations("fmap");
  const roleT = useTranslations("role");
  const categoryT = useTranslations("profileCategory");
  const today = vietnamDateKey();
  const invalidTime = value.end <= value.start;
  const [provinces, setProvinces] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    fetch(provincesApiPath())
      .then((res) => res.json())
      .then((body) => startTransition(() => setProvinces(body.data ?? [])))
      .catch(() => {});
  }, []);

  const categoryOptions = CATEGORIES_BY_ROLE[value.role] ?? [];

  return (
    <div
      id="fmap-filters"
      className="rounded-[var(--fg-radius-xl)] border border-border-default bg-bg-surface p-3 shadow-[var(--shadow-lg)] sm:p-4"
    >
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
          disabled={isLoading || invalidTime || !value.date}
          onClick={onSearch}
        >
          <Search />
        </Button>
      </div>
      <div
        className={cn(
          expanded ? "mt-3 grid" : "hidden",
          "gap-3 sm:mt-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 lg:items-end 2xl:grid-cols-[auto_1.1fr_1fr_1.4fr_1.1fr_1.1fr_auto]",
        )}
      >
        <Button
          type="button"
          variant="secondary"
          onClick={onUseLocation}
          className="h-[46px]"
        >
          <LocateFixed />
          {t("filters.myLocation")}
        </Button>
        <NativeSelect
          label={t("filters.province")}
          value={provinceId}
          options={[
            { value: "", label: t("filters.chooseProvince") },
            ...provinces.map((province) => ({
              value: province.id,
              label: province.name,
            })),
          ]}
          onChange={onProvinceChange}
        />
        <DateField
          label={t("filters.date")}
          min={today}
          value={value.date}
          onChange={(date) => onChange({ ...value, date })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="time"
            label={t("filters.start")}
            value={value.start}
            onChange={(event) =>
              onChange({ ...value, start: event.target.value })
            }
          />
          <Input
            type="time"
            label={t("filters.end")}
            min={value.start}
            value={value.end}
            error={invalidTime ? t("filters.invalidTime") : undefined}
            onChange={(event) =>
              onChange({ ...value, end: event.target.value })
            }
          />
        </div>
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
        <Button
          type="button"
          className="h-[46px]"
          disabled={isLoading || invalidTime || !value.date}
          onClick={onSearch}
        >
          <Search />
          {isLoading ? t("filters.searching") : t("filters.search")}
        </Button>
      </div>
      <p className="mt-2 hidden sm:block text-body-sm text-text-tertiary">
        {t("filters.mapHint")}
      </p>
    </div>
  );
}
