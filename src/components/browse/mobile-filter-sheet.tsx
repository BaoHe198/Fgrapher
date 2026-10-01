"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { FilterSidebar } from "./filter-sidebar";

export function MobileFilterSheet({
  roleCounts,
  categoryCounts,
  activeCount,
  resultCount,
  marketplaceEnabled,
  side = "left",
}: {
  /** Tìm kiếm F v2 opens it from the right as the "Bộ lọc" drawer. */
  side?: "left" | "right";
  roleCounts: Record<string, number>;
  categoryCounts: Partial<Record<string, number>>;
  activeCount: number;
  resultCount: number;
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("sharedComponents.mobileFilterSheet");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="md" className="shrink-0">
            <SlidersHorizontal className="size-4" />
            {t("filtersButton")}
            {activeCount > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-brand-primary text-meta font-semibold text-text-on-brand">
                {activeCount}
              </span>
            ) : null}
          </Button>
        }
      />
      <SheetContent
        side={side}
        className="flex w-[88%] flex-col overflow-hidden sm:max-w-sm"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <FilterSidebar
            roleCounts={roleCounts}
            categoryCounts={categoryCounts}
            marketplaceEnabled={marketplaceEnabled}
            inSheet
          />
        </div>
        {/* Filters apply as they are ticked, but nothing said so and the
            only way back to the results was a small × at the top. */}
        <div className="border-t border-border-subtle p-4">
          <Button
            variant="accent"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            {t("showResults", { count: resultCount })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
