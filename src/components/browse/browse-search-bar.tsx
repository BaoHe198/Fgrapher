"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { useSharedFilterParams } from "@/components/filters/filter-params-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";
import { shortPlace } from "@/lib/location";
import { cn } from "@/lib/utils";

import { BrowseSearchPill } from "./browse-search-pill";
import { FilterSidebar } from "./filter-sidebar";

const MOBILE_QUERY = "(max-width: 767px)";

function subscribeMobile(callback: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

// Tìm kiếm F's search controls (Core MVP pass, 02/10/2026). Phones get one
// compact row - "khu vực · ngày" and a Bộ lọc button - and both open the
// same sheet from the bottom; from 768px the area/date pill stays, with
// Bộ lọc opening the sheet from the right. The badge counts only the
// advanced filters, never the role or area already shown on screen; the
// sheet's main button reads the real number of results.
export function BrowseSearchBar({
  provinces,
  roleCounts,
  categoryCounts,
  advancedCount,
  resultCount,
  marketplaceEnabled,
}: {
  provinces: { code: string; name: string }[];
  roleCounts: Record<string, number>;
  categoryCounts: Partial<Record<string, number>>;
  advancedCount: number;
  resultCount: number;
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("publicPages.browse.v3");
  const { params, reset } = useSharedFilterParams();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const province = provinces.find((p) => p.code === params.get("city"));
  const date = params.get("date");
  const summaryPlace = province ? shortPlace(province.name) : t("anywhere");
  const summaryDate = date
    ? formatDate(`${date}T00:00:00+07:00`).slice(0, 5)
    : t("anyDate");

  const filterButton = (compact: boolean) => (
    <Button
      variant="outline"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-label={
        compact
          ? advancedCount > 0
            ? t("filtersWithCount", { count: advancedCount })
            : t("filters")
          : undefined
      }
      className={cn("relative shrink-0", compact ? "size-12 px-0" : "h-12")}
    >
      <SlidersHorizontal aria-hidden className="size-4" />
      {compact ? null : t("filters")}
      {advancedCount > 0 ? (
        <span
          aria-hidden={compact}
          className={cn(
            "grid size-5 place-items-center rounded-full bg-brand-primary text-meta font-semibold text-text-on-brand",
            compact && "absolute -top-1 -right-1",
          )}
        >
          {advancedCount}
        </span>
      ) : null}
    </Button>
  );

  return (
    <>
      <div className="flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="focus-ring flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border-default bg-bg-surface px-4 text-left text-body-md"
        >
          <Search aria-hidden className="size-4 shrink-0 text-text-secondary" />
          <span className="truncate">
            <strong className="font-semibold text-text-primary">
              {summaryPlace}
            </strong>
            <span className="text-text-secondary"> · {summaryDate}</span>
          </span>
        </button>
        {filterButton(true)}
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <div className="min-w-0 flex-1">
          <BrowseSearchPill provinces={provinces} />
        </div>
        {filterButton(false)}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col overflow-hidden",
            isMobile ? "h-[92dvh]" : "w-[88%] sm:max-w-sm",
          )}
        >
          <SheetHeader>
            <SheetTitle>{t("filters")}</SheetTitle>
            <SheetDescription className="sr-only">
              {t("filtersDescription")}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <FilterSidebar
              roleCounts={roleCounts}
              categoryCounts={categoryCounts}
              marketplaceEnabled={marketplaceEnabled}
              inSheet
            />
          </div>
          <div className="flex items-center gap-3 border-t border-border-subtle px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={reset}
              className="focus-ring min-h-12 rounded-[var(--fg-radius-sm)] px-2 text-body-md font-semibold text-text-primary underline underline-offset-4"
            >
              {t("clearAll")}
            </button>
            <Button
              variant="accent"
              className="h-12 flex-1"
              onClick={() => setOpen(false)}
            >
              {resultCount > 0
                ? t("seeResults", { count: resultCount })
                : t("noResults")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
