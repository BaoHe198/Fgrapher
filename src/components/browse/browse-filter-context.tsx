"use client";

import { createContext, useContext, useTransition } from "react";

interface BrowseFilterContextValue {
  isPending: boolean;
  runNavigation: (fn: () => void) => void;
}

const BrowseFilterContext = createContext<BrowseFilterContextValue | null>(null);

// Shares one useTransition between the filter controls (which trigger
// navigation) and the results grid (which just wants to know when a
// navigation is in flight so it can dim itself) — they're siblings under
// the browse page's Server Component, so this is the only way to connect
// "user clicked a filter" to "results are stale" without prop-drilling
// through the server boundary.
export function BrowseFilterProvider({ children }: { children: React.ReactNode }) {
  const [isPending, startTransition] = useTransition();
  return (
    <BrowseFilterContext.Provider value={{ isPending, runNavigation: startTransition }}>
      {children}
    </BrowseFilterContext.Provider>
  );
}

function useBrowseFilterContext() {
  const ctx = useContext(BrowseFilterContext);
  if (!ctx) throw new Error("useBrowseFilterContext must be used within a BrowseFilterProvider");
  return ctx;
}

export function useBrowseFilterPending() {
  return useBrowseFilterContext().isPending;
}

export function useBrowseFilterNavigation() {
  return useBrowseFilterContext().runNavigation;
}
