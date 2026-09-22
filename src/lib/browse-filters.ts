import type { ExperienceLevel, ProfileCategory, Role } from "@prisma/client";

import { CATEGORIES_BY_ROLE } from "@/lib/constants";
import { setOrDelete } from "@/lib/filter-params";

export interface BrowseFilterState {
  roles: Role[];
  serviceKinds: string[];
  sort: string;
  city: string;
  ward: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  categories: ProfileCategory[];
  heightMin: string;
  heightMax: string;
  experienceLevel: ExperienceLevel[];
  travelWilling: boolean;
}

/**
 * The query keys the sidebar owns. Anything else on /browse — `q` above
 * all, but also `page` — belongs to another control and must survive a
 * filter change untouched. Writing the sidebar's state used to mean
 * rebuilding the whole query string from a BrowseFilterState, which has no
 * `q` field, so every filter click silently threw the search keyword away
 * (QA-01, 22/09/2026).
 */
export const BROWSE_FILTER_KEYS = [
  "roles",
  "services",
  "sort",
  "city",
  "ward",
  "minPrice",
  "maxPrice",
  "minRating",
  "categories",
  "heightMin",
  "heightMax",
  "experienceLevel",
  "travelWilling",
] as const;

export const EMPTY_BROWSE_FILTERS: BrowseFilterState = {
  roles: [],
  serviceKinds: [],
  sort: "rating",
  city: "",
  ward: "",
  minPrice: "",
  maxPrice: "",
  minRating: "",
  categories: [],
  heightMin: "",
  heightMax: "",
  experienceLevel: [],
  travelWilling: false,
};

function list(params: URLSearchParams, key: string): string[] {
  return params.get(key)?.split(",").filter(Boolean) ?? [];
}

export function readBrowseFilters(params: URLSearchParams): BrowseFilterState {
  return {
    roles: list(params, "roles") as Role[],
    serviceKinds: list(params, "services"),
    sort: params.get("sort") ?? "rating",
    city: params.get("city") ?? "",
    ward: params.get("ward") ?? "",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    minRating: params.get("minRating") ?? "",
    categories: list(params, "categories") as ProfileCategory[],
    heightMin: params.get("heightMin") ?? "",
    heightMax: params.get("heightMax") ?? "",
    experienceLevel: list(params, "experienceLevel") as ExperienceLevel[],
    travelWilling: params.get("travelWilling") === "1",
  };
}

/** Writes the sidebar's keys into `params` in place, leaving the rest alone. */
export function writeBrowseFilters(
  params: URLSearchParams,
  filters: BrowseFilterState,
): void {
  setOrDelete(params, "roles", filters.roles.join(","));
  setOrDelete(params, "services", filters.serviceKinds.join(","));
  setOrDelete(params, "sort", filters.sort === "rating" ? "" : filters.sort);
  setOrDelete(params, "city", filters.city);
  setOrDelete(params, "ward", filters.city ? filters.ward : "");
  setOrDelete(params, "minPrice", filters.minPrice);
  setOrDelete(params, "maxPrice", filters.maxPrice);
  setOrDelete(params, "minRating", filters.minRating);
  // Categories are valid with 0, 1, or 2+ roles selected (the sidebar
  // renders checkboxes in all three cases, and the backend filters on
  // category independently of role) — unlike the MODEL-only fields below,
  // this isn't gated to a single role.
  setOrDelete(params, "categories", filters.categories.join(","));

  // MODEL-specific filters only apply when scoped to that one role — drop
  // them from the URL entirely otherwise so switching roles doesn't leave
  // a stale, invisible filter narrowing results.
  const modelOnly = filters.roles.length === 1 && filters.roles[0] === "MODEL";
  setOrDelete(params, "heightMin", modelOnly ? filters.heightMin : "");
  setOrDelete(params, "heightMax", modelOnly ? filters.heightMax : "");
  setOrDelete(
    params,
    "experienceLevel",
    modelOnly ? filters.experienceLevel.join(",") : "",
  );
  setOrDelete(
    params,
    "travelWilling",
    modelOnly && filters.travelWilling ? "1" : "",
  );
}

/** Removes every sidebar key, leaving `q` (and anything else) in place. */
export function clearBrowseFilters(params: URLSearchParams): void {
  for (const key of BROWSE_FILTER_KEYS) params.delete(key);
}

/**
 * Categories that survive a change of roles: one still offered by at least
 * one selected role. With no role selected the category list on screen goes
 * back to "most popular platform-wide", so nothing stays checked.
 */
export function categoriesStillValid(
  roles: Role[],
  categories: ProfileCategory[],
): ProfileCategory[] {
  if (roles.length === 0) return [];
  const valid = new Set(
    roles.flatMap((role) => CATEGORIES_BY_ROLE[role] ?? []),
  );
  return categories.filter((category) => valid.has(category));
}
