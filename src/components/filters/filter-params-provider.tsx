"use client";

import { createContext, useContext } from "react";

import {
  useFilterParams,
  type FilterParamsController,
} from "@/hooks/use-filter-params";
import { cn } from "@/lib/utils";

const FilterParamsContext = createContext<FilterParamsController | null>(null);

/**
 * Gives one page's filter controls a single, shared owner of the query
 * string, and lets the results grid know a navigation is in flight.
 *
 * Sharing it is not a convenience. While each control kept its own copy of
 * the query, /browse's sidebar rebuilt the whole string from a state object
 * with no `q` field in it, so ticking a role silently erased whatever the
 * visitor had searched for (QA-01, 22/09/2026). It also keeps the desktop
 * sidebar and the mobile filter sheet — both mounted at the same time —
 * from drifting apart.
 */
export function FilterParamsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const controller = useFilterParams();
  return (
    <FilterParamsContext.Provider value={controller}>
      {children}
    </FilterParamsContext.Provider>
  );
}

export function useSharedFilterParams(): FilterParamsController {
  const ctx = useContext(FilterParamsContext);
  if (!ctx) {
    throw new Error(
      "useSharedFilterParams must be used within a FilterParamsProvider",
    );
  }
  return ctx;
}

/**
 * Wraps a results grid so the previous results can't be mistaken for the
 * answer to the filter that was just changed — the exact complaint in QA-01
 * ("không được để danh sách cũ trông như kết quả của bộ lọc mới"). Dimming
 * alone proved too quiet, so this also says it in words.
 *
 * `label` comes from the page rather than from a hook here: each page owns
 * its own translation namespace.
 */
export function FilterResultsPane({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { isPending } = useSharedFilterParams();

  return (
    <div className="relative">
      {isPending ? (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        >
          <span className="rounded-full bg-bg-surface px-4 py-1.5 text-body-sm text-text-secondary shadow-[var(--shadow-sm)]">
            {label}
          </span>
        </div>
      ) : null}
      <div
        aria-busy={isPending}
        className={cn(
          "transition-opacity duration-150",
          isPending && "opacity-40",
        )}
      >
        {children}
      </div>
    </div>
  );
}
