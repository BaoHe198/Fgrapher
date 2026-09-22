"use client";

import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SERVICE_KINDS } from "@/lib/constants/service-matrix";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { toast } from "@/components/ui/toast";
import {
  CATEGORIES_BY_ROLE,
  EXPERIENCE_LEVELS,
  DISCOVERABLE_ROLES,
} from "@/lib/constants";
import { provincesApiPath, wardsApiPath } from "@/lib/geography-client";
import {
  categoriesStillValid,
  clearBrowseFilters,
  readBrowseFilters,
  writeBrowseFilters,
  type BrowseFilterState,
} from "@/lib/browse-filters";

import { useSharedFilterParams } from "@/components/filters/filter-params-provider";

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

interface WardOption {
  id: string;
  name: string;
}

// Labels for these three option lists are resolved inside the component via
// useTranslations, since module scope has no access to the hook.

// Batching window for router.push() calls — checkbox/radio clicks feel
// instant because local state updates synchronously, but the actual
// navigation is debounced by this much so a burst of clicks (e.g. checking
// 3 roles in a row) produces one navigation instead of one per click.
const NAVIGATE_DEBOUNCE_MS = 200;

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
  const serviceKindT = useTranslations("serviceKind");
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
  const roleFilterOptions = marketplaceEnabled
    ? [...DISCOVERABLE_ROLES, "CAMERA_SHOP" as const]
    : DISCOVERABLE_ROLES;
  // The page's single source of truth for the query string, shared with the
  // search box and with the other copy of this sidebar inside the mobile
  // filter sheet. `params` is optimistic, so a checkbox reflects the click
  // immediately even while the results are still being fetched.
  const { params, navigate } = useSharedFilterParams();
  const filters = readBrowseFilters(params);
  // Real nationwide Province/Ward rows, never a hardcoded UI list.
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  useEffect(() => {
    fetch(provincesApiPath())
      .then((res) => res.json())
      .then((body) => startTransition(() => setProvinces(body.data ?? [])));
  }, []);

  const [wards, setWards] = useState<WardOption[]>([]);
  useEffect(() => {
    if (!filters.city) {
      startTransition(() => setWards([]));
      return;
    }
    fetch(wardsApiPath(filters.city))
      .then((res) => res.json())
      .then((body) => startTransition(() => setWards(body.data ?? [])))
      .catch(() => startTransition(() => setWards([])));
  }, [filters.city]);
  // Every handler below mutates only the keys it owns, on top of the
  // controller's latest intent — never a whole query string rebuilt from a
  // snapshot. That is what keeps the search keyword (and any future param
  // this sidebar knows nothing about) alive across a filter click.
  const applyFilters = (
    patch: Partial<BrowseFilterState>,
    immediate = false,
  ) => {
    navigate(
      (next) =>
        writeBrowseFilters(next, { ...readBrowseFilters(next), ...patch }),
      { debounceMs: immediate ? 0 : NAVIGATE_DEBOUNCE_MS },
    );
  };

  // What the customer wants DONE, which is a different question from what
  // the provider is called — a studio with a crew offers PHOTOGRAPHY, so
  // filtering by that has to reach it.
  const toggleServiceKind = (kind: string) => {
    navigate(
      (next) => {
        const current = readBrowseFilters(next);
        writeBrowseFilters(next, {
          ...current,
          serviceKinds: current.serviceKinds.includes(kind)
            ? current.serviceKinds.filter((k) => k !== kind)
            : [...current.serviceKinds, kind],
        });
      },
      { debounceMs: NAVIGATE_DEBOUNCE_MS },
    );
  };

  const toggleRole = (role: Role) => {
    let dropped = 0;
    navigate(
      (next) => {
        const current = readBrowseFilters(next);
        const roles = current.roles.includes(role)
          ? current.roles.filter((r) => r !== role)
          : [...current.roles, role];

        // Prompt G4, VIỆC 1 — categories now stay meaningful for 0 or 2+
        // selected roles too (see the render logic below), so only drop a
        // selected category that's no longer valid for ANY currently-
        // selected role, and tell the user when that happens instead of
        // silently clearing it.
        const categories = categoriesStillValid(roles, current.categories);
        dropped = current.categories.length - categories.length;

        // Height/experience/travel are MODEL-only; writeBrowseFilters drops
        // them from the URL itself once the selection is no longer that one
        // role, so there is nothing to clear by hand here.
        writeBrowseFilters(next, { ...current, roles, categories });
      },
      { debounceMs: NAVIGATE_DEBOUNCE_MS },
    );
    if (dropped > 0) {
      toast.add({ title: t("categoriesClearedNotice"), type: "info" });
    }
  };

  const toggleCategory = (category: ProfileCategory) => {
    navigate(
      (next) => {
        const current = readBrowseFilters(next);
        writeBrowseFilters(next, {
          ...current,
          categories: current.categories.includes(category)
            ? current.categories.filter((c) => c !== category)
            : [...current.categories, category],
        });
      },
      { debounceMs: NAVIGATE_DEBOUNCE_MS },
    );
  };

  const toggleExperienceLevel = (level: ExperienceLevel) => {
    navigate(
      (next) => {
        const current = readBrowseFilters(next);
        writeBrowseFilters(next, {
          ...current,
          experienceLevel: current.experienceLevel.includes(level)
            ? current.experienceLevel.filter((l) => l !== level)
            : [...current.experienceLevel, level],
        });
      },
      { debounceMs: NAVIGATE_DEBOUNCE_MS },
    );
  };

  const onBudgetChange = (value: string) => {
    if (!value) {
      applyFilters({ minPrice: "", maxPrice: "" });
      return;
    }
    const [min, max] = value.split("-");
    applyFilters({ minPrice: min || "", maxPrice: max || "" });
  };

  // Clears the sidebar's own criteria. The search keyword is the search
  // box's to clear (it has its own ✕), so this no longer silently wipes it.
  const resetFilters = () => {
    navigate((next) => clearBrowseFilters(next));
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
    // A category can appear under more than one role's list (e.g. "Cưới"
    // is valid for both PHOTOGRAPHER and VIDEOGRAPHER) — flatMap alone
    // would duplicate it here since this branch renders one flat,
    // ungrouped list (unlike the 2+-roles branch above, where each
    // role gets its own group/key-space and a repeat is fine).
    const popular = [
      ...new Set(STYLE_ROLES.flatMap((role) => CATEGORIES_BY_ROLE[role] ?? [])),
    ]
      .sort((a, b) => (categoryCounts[b] ?? 0) - (categoryCounts[a] ?? 0))
      .slice(0, POPULAR_CATEGORIES_COUNT);
    categoryGroups = [{ role: null, categories: popular }];
  }
  const hasAnyCategory = categoryGroups.some((g) => g.categories.length > 0);

  return (
    <div className="sticky top-[104px] flex flex-col gap-[22px] rounded-[var(--fg-radius-lg)] bg-surface-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("serviceLabel")}
        </span>
        <div className="flex flex-col gap-2.5">
          {SERVICE_KINDS.map((kind) => (
            <Checkbox
              key={kind}
              checked={filters.serviceKinds.includes(kind)}
              onCheckedChange={() => toggleServiceKind(kind)}
              label={serviceKindT(kind)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("roleLabel")}
        </span>
        <div className="flex flex-col gap-2.5">
          {roleFilterOptions.map((role) => {
            const count = roleCounts[role] ?? 0;
            return (
              <Checkbox
                key={role}
                checked={filters.roles.includes(role)}
                onCheckedChange={() => toggleRole(role)}
                // Matching the category checkboxes below (already
                // disabled at 0) — QA flagged the filter sheet as long
                // and still showing plenty of options that can only ever
                // return nothing; a checked-but-disabled role isn't
                // reachable, so this only applies while unchecked.
                disabled={count === 0 && !filters.roles.includes(role)}
                label={`${roleT(role)} (${count})`}
              />
            );
          })}
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
                  className="text-body-sm font-semibold! text-text-link"
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
                    <span className="text-body-sm font-semibold! text-text-secondary">
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
                      className="self-start text-body-sm font-semibold! text-text-link"
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
        onChange={(value) => applyFilters({ city: value, ward: "" })}
        options={[
          { value: "", label: t("allCities") },
          ...provinces.map((p) => ({ value: p.code, label: p.name })),
        ]}
      />

      <NativeSelect
        label={t("wardLabel")}
        value={filters.ward}
        onChange={(value) => applyFilters({ ward: value })}
        disabled={!filters.city || wards.length === 0}
        options={[
          { value: "", label: t("allWards") },
          ...wards.map((w) => ({ value: w.id, label: w.name })),
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
