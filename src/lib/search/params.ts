import { ExperienceLevel, ProfileCategory, ServiceKind } from "@prisma/client";

import type { SearchParams, SortOption } from "@/services/search";

const VALID_SORTS: readonly SortOption[] = [
  "rating",
  "price_asc",
  "price_desc",
  "newest",
  "reviews",
];

export function normalizeSort(value: string | null | undefined): SortOption {
  return VALID_SORTS.includes(value as SortOption)
    ? (value as SortOption)
    : "rating";
}

// Long enough for any real search; a pasted essay only slows the query.
const MAX_QUERY_LENGTH = 100;
const MAX_LIMIT = 50;

function finiteOrUndefined(
  value: number | undefined,
  min: number,
  max = Number.POSITIVE_INFINITY,
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(value, min), max);
}

function onlyKnown<T extends string>(
  values: readonly string[] | undefined,
  known: Record<string, T>,
): T[] | undefined {
  if (!values) return undefined;
  const allowed = new Set<string>(Object.values(known));
  const kept = values.filter((v) => allowed.has(v)) as T[];
  return kept.length > 0 ? kept : undefined;
}

/**
 * Search filters arrive straight from the URL, so anything can be in them: a
 * link cut off mid-paste, a hand-edited address, a stale bookmark from before
 * a category was renamed. Unknown enum values used to reach Prisma and crash
 * the whole page (HTTP 500); non-numbers became NaN. This keeps what is valid,
 * drops what is not, and never throws.
 *
 * Roles are left alone: searchProfiles already narrows them to the
 * searchable set, and an unknown one correctly matches nobody.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The shoot-date filter: a real calendar date, and a from-to pair only when
 * both are valid times with `from` before `to`. A half or reversed range is
 * dropped rather than guessed at; the date alone still filters.
 */
export function sanitizeShootWindow(
  date: string | undefined,
  from: string | undefined,
  to: string | undefined,
): { date?: string; from?: string; to?: string } {
  if (!date || !DATE_RE.test(date)) return {};
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return {};
  if (from && to && TIME_RE.test(from) && TIME_RE.test(to) && from < to)
    return { date, from, to };
  return { date };
}

export function sanitizeSearchParams(params: SearchParams): SearchParams {
  const page = finiteOrUndefined(params.page, 1);
  const limit = finiteOrUndefined(params.limit, 1, MAX_LIMIT);
  const q = params.q?.trim().slice(0, MAX_QUERY_LENGTH);

  return {
    ...params,
    ...{ date: undefined, from: undefined, to: undefined },
    ...sanitizeShootWindow(params.date, params.from, params.to),
    q: q ? q : undefined,
    serviceKinds: onlyKnown(params.serviceKinds, ServiceKind),
    categories: onlyKnown(params.categories, ProfileCategory),
    experienceLevel: onlyKnown(params.experienceLevel, ExperienceLevel),
    minPrice: finiteOrUndefined(params.minPrice, 0),
    maxPrice: finiteOrUndefined(params.maxPrice, 0),
    minRating: finiteOrUndefined(params.minRating, 0, 5),
    heightMin: finiteOrUndefined(params.heightMin, 0, 300),
    heightMax: finiteOrUndefined(params.heightMax, 0, 300),
    sort: params.sort === undefined ? undefined : normalizeSort(params.sort),
    page: page === undefined ? undefined : Math.floor(page),
    limit: limit === undefined ? undefined : Math.floor(limit),
  };
}
