"use client";

import { SlidersHorizontal } from "lucide-react";
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
  activeCount,
  marketplaceEnabled,
}: {
  roleCounts: Record<string, number>;
  activeCount: number;
  marketplaceEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="secondary" size="sm">
            <SlidersHorizontal className="size-4" />
            Filters
            {activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        }
      />
      <SheetContent side="left" className="w-3/4 overflow-y-auto sm:max-w-xs">
        <SheetHeader className="sr-only">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Browse filters</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <FilterSidebar
            roleCounts={roleCounts}
            marketplaceEnabled={marketplaceEnabled}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
