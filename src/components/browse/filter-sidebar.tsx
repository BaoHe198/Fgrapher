"use client";

import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { toast } from "@/components/ui/toast";
import {
  CATEGORIES_BY_ROLE,
  EXPERIENCE_LEVELS,
  PAID_ROLES,
} from "@/lib/constants";

import { useBrowseFilterNavigation } from "./browse-filter-context";

// Roles that have a specialty-category list at all (CAMERA_SHOP doesn't).
const STYLE_ROLES = Object.keys(CATEGORIES_BY_ROLE) as Role[];

// Prompt G4, VIỆC 2 — long groups (photographer alone has 12) collapse to
// this many with a "show more" toggle, rather than dumping the whole list.
const COLLAPSE_THRESHOLD = 6;
// How many "most popular platform-wide" categories to show before any
// role is selected, before the "see all" expansion.
const POPULAR_CATEGORIES_COUNT = 8;

interface ProvinceOption {
  id: string;
  code: string;
  name: string;
}

// Labels for these three option lists are resolved inside the component via
// useTranslations, since module scope has no access to the hook.

// Batching window for router.push() calls — checkbox/radio clicks feel
// instant because local state updates synchronously, but the actual
// navigation is debounced by this much so a burst of clicks (e.g. checking
// 3 roles in a row) produces one navigation instead of one per click.
const NAVIGATE_DEBOUNCE_MS = 200;

interface FilterState {
  roles: Role[];
  sort: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  categories: ProfileCategory[];
  heightMin: string;
  heightMax: string;
  experienceLevel: ExperienceLevel[];
  travelWilling: boolean;
}

function filterStateFromParams(searchParams: URLSearchParams): FilterState {
  return {
    roles: (searchParams.get("roles")?.split(",").filter(Boolean) ??
      []) as Role[],
    sort: searchParams.get("sort") ?? "rating",
    city: searchParams.get("city") ?? "",
    minPrice: searchParams.get("minPrice") ?? "",
    maxPrice: searchParams.get("maxPrice") ?? "",
    minRating: searchParams.get("minRating") ?? "",
    categories: (searchParams.get("categories")?.split(",").filter(Boolean) ??
      []) as ProfileCategory[],
    heightMin: searchParams.get("heightMin") ?? "",
    heightMax: searchParams.get("heightMax") ?? "",
    experienceLevel: (searchParams
      .get("experienceLevel")
      ?.split(",")
      .filter(Boolean) ?? []) as ExperienceLevel[],
    travelWilling: searchParams.get("travelWilling") === "1",
  };
}

function filterStateToQuery(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.roles.length > 0) params.set("roles", filters.roles.join(","));
  if (filters.sort !== "rating") params.set("sort", filters.sort);
  if (filters.city) params.set("city", filters.city);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.minRating) params.set("minRating", filters.minRating);
  // Role-specific filters only apply when scoped to a single role — drop
  // them from the URL entirely otherwise so switching roles doesn't leave
  // a stale, invisible filter narrowing results.
  if (filters.roles.length === 1) {
    if (filters.categories.length > 0)
      params.set("categories", filters.categories.join(","));
    if (filters.roles[0] === "MODEL") {
      if (filters.heightMin) params.set("heightMin", filters.heightMin);
      if (filters.heightMax) params.set("heightMax", filters.heightMax);
      if (filters.experienceLevel.length > 0)
        params.set("experienceLevel", filters.experienceLevel.join(","));
      if (filters.travelWilling) params.set("travelWilling", "1");
    }
  }
  return params.toString();
}

interface FilterSidebarProps {
  roleCounts: Record<string, number>;
  categoryCounts: Partial<Record<string, number>>;
  marketplaceEnabled: boolean;
}

export function FilterSidebar({
  roleCounts,
  categoryCounts,
  marketplaceEnabled,
}: FilterSidebarProps) {
  const t = useTranslations("sharedComponents.filterSidebar");
  const roleT = useTranslations("role");
  const categoryT = useTranslations("profileCategory");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<Role>>(new Set());
  const experienceLevelT = useTranslations("experienceLevel");
  const BUDGET_OPTIONS = [
    { value: "", label: t("budgetAny") },
    { value: "0-2000000", label: t("budgetUnder2m") },
    { value: "2000000-5000000", label: t("budget2to5m") },
    { value: "5000000-15000000", label: t("budget5to15m") },
    { value: "15000000-", label: t("budgetOver15m") },
  ];
  const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: "rating", label: t("sortTopRated") },
    { value: "price_asc", label: t("sortPriceAsc") },
    { value: "price_desc", label: t("sortPriceDesc") },
    { value: "newest", label: t("sortNewest") },
    { value: "reviews", label: t("sortMostReviewed") },
  ];
  const RATING_OPTIONS = [
    { value: "", label: t("ratingAny") },
    { value: "4", label: t("rating4Plus") },
    { value: "4.5", label: t("rating45Plus") },
  ];
  const router = useRouter();
  const roleFilterOptions = marketplaceEnabled
    ? PAID_ROLES
    : PAID_ROLES.filter((role) => role !== "CAMERA_SHOP");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const runNavigation = useBrowseFilterNavigation();

  const [filters, setFilters] = useState<FilterState>(() =>
    filterStateFromParams(searchParams),
  );
  // Real Province rows, not a hardcoded list (CLAUDE.md mục 9) — today
  // this is just Thành phố Hồ Chí Minh until more provinces' real ward
  // data is seeded (see prisma/data/hcmc-wards.ts).
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  useEffect(() => {
    fetch("/api/geography/provinces")
      .then((res) => res.json())
      .then((body) => startTransition(() => setProvinces(body.data ?? [])));
  }, []);
  // Mirrors `filters` synchronously (state updates are batched/async, this
  // isn't) so a click reads the freshest local intent even if it fires
  // before React has re-rendered from the previous click. Written only in
  // event handlers/effects below, never during render.
  const filtersRef = useRef(filters);

  // What we last pushed ourselves, so the resync effect below can tell "the
  // URL changed because our own navigation caught up" apart from "the URL
  // changed for an external reason" (back/forward button, a direct link).
  const lastPushedRef = useRef(filterStateToQuery(filters));
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const current = searchParams.toString();
    if (current === lastPushedRef.current) return;
    lastPushedRef.current = current;
    const next = filterStateFromParams(searchParams);
    filtersRef.current = next;
    setFilters(next);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, []);

  const scheduleNavigate = (next: FilterState, immediate = false) => {
    if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);

    const push = () => {
      const query = filterStateToQuery(next);
      lastPushedRef.current = query;
      runNavigation(() => {
        router.push(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    };

    if (immediate) push();
    else navigateTimerRef.current = setTimeout(push, NAVIGATE_DEBOUNCE_MS);
  };

  const applyFilters = (patch: Partial<FilterState>, immediate = false) => {
    const next = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    setFilters(next);
    scheduleNavigate(next, immediate);
  };

  const toggleRole = (role: Role) => {
    const current = filtersRef.current.roles;
    const roles = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];

    // Prompt G4, VIỆC 1 — categories now stay meaningful for 0 or 2+
    // selected roles too (see the render logic below), so only drop a
    // selected category that's no longer valid for ANY currently-selected
    // role, and tell the user when that happens instead of silently
    // clearing it.
    const validCategories = new Set(
      roles.flatMap((r) => CATEGORIES_BY_ROLE[r] ?? []),
    );
    const currentCategories = filtersRef.current.categories;
    const categories =
      roles.length === 0
        ? []
        : currentCategories.filter((c) => validCategories.has(c));
    const droppedCount = currentCategories.length - categories.length;
    if (droppedCount > 0) {
      toast.add({ title: t("categoriesClearedNotice"), type: "info" });
    }

    const singleRole = roles.length === 1 ? roles[0] : null;
    applyFilters({
      roles,
      categories,
      // Height/experience/travel are MODEL-only and only apply when
      // scoped to exactly that one role.
      ...(singleRole === "MODEL"
        ? {}
        : {
            heightMin: "",
            heightMax: "",
            experienceLevel: [],
            travelWilling: false,
          }),
    });
  };

  const toggleCategory = (category: ProfileCategory) => {
    const current = filtersRef.current.categories;
    const categories = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    applyFilters({ categories });
  };

  const toggleExperienceLevel = (level: ExperienceLevel) => {
    const current = filtersRef.current.experienceLevel;
    const experienceLevel = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    applyFilters({ experienceLevel });
  };

  const onBudgetChange = (value: string) => {
    if (!value) {
      applyFilters({ minPrice: "", maxPrice: "" });
      return;
    }
    const [min, max] = value.split("-");
    applyFilters({ minPrice: min || "", maxPrice: max || "" });
  };

  const resetFilters = () => {
    const empty: FilterState = {
      roles: [],
      sort: "rating",
      city: "",
      minPrice: "",
      maxPrice: "",
      minRating: "",
      categories: [],
      heightMin: "",
      heightMax: "",
      experienceLevel: [],
      travelWilling: false,
    };
    filtersRef.current = empty;
    setFilters(empty);
    scheduleNavigate(empty, true);
  };

  const toggleGroupExpand = (role: Role) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const budget = `${filters.minPrice}-${filters.maxPrice}`.replace(/^-$/, "");
  const singleRole = filters.roles.length === 1 ? filters.roles[0] : null;

  // Prompt G4, VIỆC 1 — categories now render in three shapes depending on
  // how many roles are selected:
  //   0 roles  -> the platform's most popular categories (by provider
  //               count), collapsed into one ungrouped list, with a "see
  //               all" toggle that switches to every role's full list
  //   1 role   -> that role's categories, no group header (the Role
  //               checkbox above already scopes it)
  //   2+ roles -> the union, grouped under a header per role
  interface CategoryGroup {
    role: Role | null;
    categories: ProfileCategory[];
  }
  let categoryGroups: CategoryGroup[];
  if (filters.roles.length === 1) {
    categoryGroups = [
      { role: null, categories: CATEGORIES_BY_ROLE[filters.roles[0]] ?? [] },
    ];
  } else if (filters.roles.length >= 2) {
    categoryGroups = filters.roles
      .map((role) => ({ role, categories: CATEGORIES_BY_ROLE[role] ?? [] }))
      .filter((group) => group.categories.length > 0);
  } else if (showAllCategories) {
    categoryGroups = STYLE_ROLES.map((role) => ({
      role,
      categories: CATEGORIES_BY_ROLE[role] ?? [],
    }));
  } else {
    const popular = STYLE_ROLES.flatMap(
      (role) => CATEGORIES_BY_ROLE[role] ?? [],
    )
      .sort((a, b) => (categoryCounts[b] ?? 0) - (categoryCounts[a] ?? 0))
      .slice(0, POPULAR_CATEGORIES_COUNT);
    categoryGroups = [{ role: null, categories: popular }];
  }
  const hasAnyCategory = categoryGroups.some((g) => g.categories.length > 0);

  return (
    <div className="sticky top-[104px] flex flex-col gap-[22px] rounded-[var(--fg-radius-lg)] bg-surface-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("roleLabel")}
        </span>
        <div className="flex flex-col gap-2.5">
          {roleFilterOptions.map((role) => (
            <Checkbox
              key={role}
              checked={filters.roles.includes(role)}
              onCheckedChange={() => toggleRole(role)}
              label={`${roleT(role)} (${roleCounts[role] ?? 0})`}
            />
          ))}
        </div>
      </div>

      {hasAnyCategory ? (
        <>
          <div className="h-px bg-border-subtle" />
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
                {t("styleLabel")}
              </span>
              {filters.roles.length === 0 && !showAllCategories ? (
                <button
                  type="button"
                  onClick={() => setShowAllCategories(true)}
                  className="text-body-sm font-semibold text-text-link"
                >
                  {t("seeAllCategories")}
                </button>
              ) : null}
            </div>
            {categoryGroups.map((group) => {
              const isExpanded = group.role
                ? expandedGroups.has(group.role)
                : true;
              const visible = isExpanded
                ? group.categories
                : group.categories.slice(0, COLLAPSE_THRESHOLD);
              const hasMore =
                group.role != null &&
                group.categories.length > COLLAPSE_THRESHOLD;
              return (
                <div
                  key={group.role ?? "popular"}
                  className="flex flex-col gap-2.5"
                >
                  {group.role ? (
                    <span className="text-body-sm font-semibold text-text-secondary">
                      {roleT(group.role)}
                    </span>
                  ) : null}
                  <div className="flex flex-col gap-2.5">
                    {visible.map((category) => {
                      const count = categoryCounts[category] ?? 0;
                      return (
                        <Checkbox
                          key={category}
                          checked={filters.categories.includes(category)}
                          onCheckedChange={() => toggleCategory(category)}
                          disabled={count === 0}
                          label={`${categoryT(category)} (${count})`}
                        />
                      );
                    })}
                  </div>
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={() =>
                        group.role && toggleGroupExpand(group.role)
                      }
                      className="self-start text-body-sm font-semibold text-text-link"
                    >
                      {isExpanded
                        ? t("showLess")
                        : t("showMore", {
                            count: group.categories.length - COLLAPSE_THRESHOLD,
                          })}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {singleRole === "MODEL" ? (
        <>
          <div className="h-px bg-border-subtle" />
          <div className="flex flex-col gap-2.5">
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
              {t("heightLabel")}
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder={t("heightMinPh")}
                value={filters.heightMin}
                onChange={(e) => applyFilters({ heightMin: e.target.value })}
                className="w-full rounded-[var(--fg-radius-sm)] border border-border-default bg-bg-surface px-3 py-2 text-body-sm text-text-primary outline-none focus:border-border-focus"
              />
              <input
                type="number"
                placeholder={t("heightMaxPh")}
                value={filters.heightMax}
                onChange={(e) => applyFilters({ heightMax: e.target.value })}
                className="w-full rounded-[var(--fg-radius-sm)] border border-border-default bg-bg-surface px-3 py-2 text-body-sm text-text-primary outline-none focus:border-border-focus"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
              {t("experienceLabel")}
            </span>
            <div className="flex flex-col gap-2.5">
              {EXPERIENCE_LEVELS.map((level) => (
                <Checkbox
                  key={level}
                  checked={filters.experienceLevel.includes(level)}
                  onCheckedChange={() => toggleExperienceLevel(level)}
                  label={experienceLevelT(level)}
                />
              ))}
            </div>
          </div>

          <Checkbox
            checked={filters.travelWilling}
            onCheckedChange={(checked) =>
              applyFilters({ travelWilling: checked })
            }
            label={t("travelWillingLabel")}
          />
        </>
      ) : null}

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("sortByLabel")}
        </span>
        <div className="flex flex-col gap-2.5">
          {SORT_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              name="sort"
              checked={filters.sort === option.value}
              onChange={() => applyFilters({ sort: option.value })}
              label={option.label}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-border-subtle" />

      <NativeSelect
        label={t("cityLabel")}
        value={filters.city}
        onChange={(value) => applyFilters({ city: value })}
        options={[
          { value: "", label: t("allCities") },
          ...provinces.map((p) => ({ value: p.code, label: p.name })),
        ]}
      />

      <NativeSelect
        label={t("budgetLabel")}
        value={budget}
        onChange={onBudgetChange}
        options={BUDGET_OPTIONS}
      />

      <div className="h-px bg-border-subtle" />

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("ratingLabel")}
        </span>
        <div className="flex flex-col gap-2.5">
          {RATING_OPTIONS.map((option) => (
            <Radio
              key={option.value}
              name="rating"
              checked={filters.minRating === option.value}
              onChange={() => applyFilters({ minRating: option.value })}
              label={option.label}
            />
          ))}
        </div>
      </div>

      <Button variant="secondary" className="w-full" onClick={resetFilters}>
        {t("resetFilters")}
      </Button>
    </div>
  );
}
