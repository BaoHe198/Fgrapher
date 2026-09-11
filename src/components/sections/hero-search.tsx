"use client";

import type { ProfileCategory, Role } from "@prisma/client";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

// Full-width row (label left, chevron right) on mobile — cramming all 5
// filters into one horizontal row there left each trigger ~56px wide,
// truncating every label down to 1-2 characters. From lg: up, reverts to
// the compact flex-1 pill segment that fits in a single row. Mobile no
// longer renders this row inline at all (see MOBILE_QUICK_BAR below) —
// this styling now only actually applies from lg: up in practice, but is
// left responsive rather than hardcoded to desktop-only values in case
// that changes.
const segmentClass =
  "flex w-full min-w-0 items-center justify-between gap-2 rounded-[var(--fg-radius-sm)] px-3.5 py-3 text-body-md text-text-primary outline-none hover:bg-bg-sunken focus-visible:bg-bg-sunken lg:w-auto lg:flex-1 lg:justify-center lg:gap-1 lg:rounded-full lg:px-3.5 lg:py-2.5 lg:text-body-sm";

// A single divider whose orientation flips with the layout: a full-width
// horizontal rule between stacked rows on mobile, a thin vertical rule
// between inline segments from lg: up.
const dividerClass = "h-px w-full bg-border-subtle lg:h-6 lg:w-px";

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
  const mobileFilterT = useTranslations("sharedComponents.mobileFilterSheet");
  const router = useRouter();

  const [role, setRole] = useState<Role | "">("");
  const [category, setCategory] = useState<ProfileCategory | "">("");
  const [provinceCode, setProvinceCode] = useState("");
  const [wardId, setWardId] = useState("");
  const [budget, setBudget] = useState<(typeof BUDGET_VALUES)[number]>("");
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

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

  const activeFilterCount = [
    role,
    category,
    provinceCode,
    wardId,
    budget,
  ].filter(Boolean).length;

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
    setFilterSheetOpen(false);
    router.push(params.toString() ? `/browse?${params.toString()}` : "/browse");
  };

  const roleDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger className={segmentClass}>
        <span className="max-w-full truncate">
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
  );

  const categoryDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger className={segmentClass}>
        <span className="max-w-full truncate">
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
  );

  const cityDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger className={segmentClass}>
        <span className="max-w-full truncate">
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
  );

  const wardDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger className={segmentClass}>
        <span className="max-w-full truncate">
          {wardId
            ? (wards.find((w) => w.id === wardId)?.name ?? filterT("wardLabel"))
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
  );

  const budgetDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger className={segmentClass}>
        <span className="max-w-full truncate">
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
  );

  const allFilters = [
    roleDropdown,
    categoryDropdown,
    cityDropdown,
    wardDropdown,
    budgetDropdown,
  ];

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Mobile (<lg): one wide "Vai trò" quick-pick, always visible, plus
          a search button and a "Bộ lọc" button opening a Sheet with all 5
          filters (city included). Fitting two dropdowns + two buttons on
          one ~375px row left each dropdown ~110px, truncating the city
          label to "Thành ..."; one dropdown gets a comfortable width.
          Desktop (lg:+) keeps the single inline pill row unchanged. */}
      <div className="flex flex-col gap-2 rounded-[var(--fg-radius-lg)] bg-bg-surface p-2 shadow-[var(--shadow-lg)] lg:hidden">
        <div className="flex items-stretch gap-1">
          <div className="min-w-0 flex-1">{roleDropdown}</div>
          <Button
            variant="accent"
            size="icon"
            className="shrink-0 rounded-[var(--fg-radius-sm)]"
            onClick={onSearch}
          >
            <Search className="size-4" />
            <span className="sr-only">{t("hero.cta")}</span>
          </Button>
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger
              render={
                <Button variant="secondary" size="icon" className="shrink-0">
                  <SlidersHorizontal className="size-4" />
                  <span className="sr-only">
                    {mobileFilterT("filtersButton")}
                    {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                  </span>
                </Button>
              }
            />
            <SheetContent
              side="bottom"
              className="max-h-[85vh] overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle>
                  {mobileFilterT("title")}
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {mobileFilterT("description")}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-1 py-2">
                {allFilters.map((filter, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    {filter}
                    {i < allFilters.length - 1 ? (
                      <div className={dividerClass} />
                    ) : null}
                  </div>
                ))}
              </div>
              {/* SheetFooter, not a bare Button: SheetContent has no padding
                  of its own (every child brings its own), so a bare child sits
                  flush against the sheet's edges — including `bottom: 0`. On
                  iOS Safari the bottom-most pixel row of the page is what the
                  browser samples to tint the strip around its floating
                  toolbar, so an edge-to-edge accent button painted the whole
                  footer gold. The footer's padding keeps the sheet's own
                  surface as the bottom-most colour. */}
              <SheetFooter>
                <Button variant="accent" size="lg" onClick={onSearch}>
                  <Search className="size-4" />
                  {t("hero.cta")}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop (lg:+): unchanged inline pill row + all 5 filters. */}
      <div className="hidden w-full flex-row items-stretch gap-2 lg:flex">
        <div className="flex flex-1 flex-row flex-wrap items-center gap-1 rounded-[var(--fg-radius-lg)] bg-bg-surface p-2 shadow-[var(--shadow-lg)]">
          {allFilters.map((filter, i) => (
            <div key={i} className="contents">
              {filter}
              {i < allFilters.length - 1 ? (
                <div className={dividerClass} />
              ) : null}
            </div>
          ))}
        </div>
        <Button
          variant="accent"
          size="lg"
          onClick={onSearch}
          className="w-full shrink-0 rounded-[var(--fg-radius-lg)] shadow-[var(--shadow-lg)] lg:w-auto lg:px-10"
        >
          <Search className="size-4" />
          {t("hero.cta")}
        </Button>
      </div>
    </div>
  );
}
