"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATEGORIES_BY_ROLE, PAID_ROLES } from "@/lib/constants";

interface ProvinceOption {
  id: string;
  code: string;
  name: string;
}

interface WardOption {
  id: string;
  name: string;
}

const BUDGET_VALUES = [
  "",
  "0-2000000",
  "2000000-5000000",
  "5000000-15000000",
  "15000000-",
] as const;

const BUDGET_LABEL_KEYS: Record<(typeof BUDGET_VALUES)[number], string> = {
  "": "budgetAny",
  "0-2000000": "budgetUnder2m",
  "2000000-5000000": "budget2to5m",
  "5000000-15000000": "budget5to15m",
  "15000000-": "budgetOver15m",
};

const segmentClass =
  "flex items-center gap-1 rounded-full px-3.5 py-2.5 text-body-sm text-text-primary outline-none hover:bg-bg-sunken focus-visible:bg-bg-sunken";

export function HeroSearch({
  marketplaceEnabled,
}: {
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations();
  const roleT = useTranslations("role");
  const categoryT = useTranslations("profileCategory");
  const browseRequestsT = useTranslations("dashboardCore.browseRequests");
  const filterT = useTranslations("sharedComponents.filterSidebar");
  const router = useRouter();

  const [role, setRole] = useState<Role | "">("");
  const [category, setCategory] = useState<ProfileCategory | "">("");
  const [provinceCode, setProvinceCode] = useState("");
  const [wardId, setWardId] = useState("");
  const [budget, setBudget] = useState<(typeof BUDGET_VALUES)[number]>("");
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);

  const roleOptions = PAID_ROLES.filter(
    (r) => marketplaceEnabled || r !== "CAMERA_SHOP",
  );
  const categoryOptions = role ? (CATEGORIES_BY_ROLE[role] ?? []) : [];

  // Real Province rows (Prompt B4), not a hardcoded list (CLAUDE.md mục 9)
  // — same data source as /browse's own city filter.
  useEffect(() => {
    fetch("/api/geography/provinces")
      .then((res) => res.json())
      .then((body) => startTransition(() => setProvinces(body.data ?? [])));
  }, []);

  // Ward coverage is HCMC-only today (see prisma/data/hcmc-wards.ts) — most
  // provinces resolve to an empty list here.
  useEffect(() => {
    if (!provinceCode) {
      startTransition(() => setWards([]));
      return;
    }
    fetch(
      `/api/geography/wards?provinceCode=${encodeURIComponent(provinceCode)}`,
    )
      .then((res) => res.json())
      .then((body) => startTransition(() => setWards(body.data ?? [])))
      .catch(() => startTransition(() => setWards([])));
  }, [provinceCode]);

  const onSearch = () => {
    const params = new URLSearchParams();
    if (role) params.set("roles", role);
    if (role && category) params.set("categories", category);
    if (provinceCode) params.set("city", provinceCode);
    if (provinceCode && wardId) params.set("ward", wardId);
    if (budget) {
      const [min, max] = budget.split("-");
      if (min) params.set("minPrice", min);
      if (max) params.set("maxPrice", max);
    }
    router.push(params.toString() ? `/browse?${params.toString()}` : "/browse");
  };

  return (
    <div className="flex max-w-[700px] flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-[var(--fg-radius-lg)] bg-bg-surface p-2 shadow-[var(--shadow-lg)]">
        <DropdownMenu>
          <DropdownMenuTrigger className={segmentClass}>
            <span className="max-w-[110px] truncate">
              {role ? roleT(role) : filterT("roleLabel")}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={role}
              onValueChange={(value) => {
                setRole(value as Role | "");
                setCategory("");
              }}
            >
              <DropdownMenuRadioItem value="">
                {browseRequestsT("allRoles")}
              </DropdownMenuRadioItem>
              {roleOptions.map((r) => (
                <DropdownMenuRadioItem key={r} value={r}>
                  {roleT(r)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px shrink-0 bg-border-subtle" />

        <DropdownMenu>
          <DropdownMenuTrigger className={segmentClass}>
            <span className="max-w-[110px] truncate">
              {category ? categoryT(category) : filterT("styleLabel")}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {categoryOptions.length === 0 ? (
              <DropdownMenuItem disabled>
                {t("hero.filters.categoryNeedsRole")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuRadioGroup
                value={category}
                onValueChange={(value) =>
                  setCategory(value as ProfileCategory | "")
                }
              >
                <DropdownMenuRadioItem value="">
                  {t("hero.filters.allCategories")}
                </DropdownMenuRadioItem>
                {categoryOptions.map((c) => (
                  <DropdownMenuRadioItem key={c} value={c}>
                    {categoryT(c)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px shrink-0 bg-border-subtle" />

        <DropdownMenu>
          <DropdownMenuTrigger className={segmentClass}>
            <span className="max-w-[110px] truncate">
              {provinceCode
                ? (provinces.find((p) => p.code === provinceCode)?.name ??
                  filterT("cityLabel"))
                : filterT("cityLabel")}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={provinceCode}
              onValueChange={(value) => {
                setProvinceCode(value as string);
                setWardId("");
              }}
            >
              <DropdownMenuRadioItem value="">
                {filterT("allCities")}
              </DropdownMenuRadioItem>
              {provinces.map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.code}>
                  {p.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px shrink-0 bg-border-subtle" />

        <DropdownMenu>
          <DropdownMenuTrigger className={segmentClass}>
            <span className="max-w-[110px] truncate">
              {wardId
                ? (wards.find((w) => w.id === wardId)?.name ??
                  filterT("wardLabel"))
                : filterT("wardLabel")}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {!provinceCode ? (
              <DropdownMenuItem disabled>
                {t("hero.filters.wardNeedsProvince")}
              </DropdownMenuItem>
            ) : wards.length === 0 ? (
              <DropdownMenuItem disabled>
                {t("hero.filters.wardUnavailable")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuRadioGroup
                value={wardId}
                onValueChange={(value) => setWardId(value as string)}
              >
                <DropdownMenuRadioItem value="">
                  {filterT("allWards")}
                </DropdownMenuRadioItem>
                {wards.map((w) => (
                  <DropdownMenuRadioItem key={w.id} value={w.id}>
                    {w.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px shrink-0 bg-border-subtle" />

        <DropdownMenu>
          <DropdownMenuTrigger className={segmentClass}>
            <span className="max-w-[110px] truncate">
              {budget
                ? filterT(
                    BUDGET_LABEL_KEYS[budget] as Parameters<typeof filterT>[0],
                  )
                : filterT("budgetLabel")}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={budget}
              onValueChange={(value) =>
                setBudget(value as (typeof BUDGET_VALUES)[number])
              }
            >
              {BUDGET_VALUES.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {filterT(
                    BUDGET_LABEL_KEYS[value] as Parameters<typeof filterT>[0],
                  )}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Button
        variant="accent"
        size="lg"
        onClick={onSearch}
        className="h-auto shrink-0 self-stretch rounded-[var(--fg-radius-lg)] px-6 shadow-[var(--shadow-lg)]"
      >
        <Search className="size-4" />
        {t("hero.cta")}
      </Button>
    </div>
  );
}
