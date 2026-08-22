"use client";

import { cn } from "@/lib/utils";

import { useBrowseFilterPending } from "./browse-filter-context";

export function ResultsPane({ children }: { children: React.ReactNode }) {
  const isPending = useBrowseFilterPending();

  return (
    <div className={cn("transition-opacity duration-150", isPending && "opacity-50")}>
      {children}
    </div>
  );
}
