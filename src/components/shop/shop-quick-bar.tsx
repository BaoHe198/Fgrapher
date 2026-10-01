"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useSharedFilterParams } from "@/components/filters/filter-params-provider";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { ShopFilters } from "./shop-filters";

const CONDITIONS = [
  ["NEW", "conditionNew"],
  ["LIKE_NEW", "conditionLikeNew"],
  ["GOOD", "conditionGood"],
  ["FAIR", "conditionFair"],
] as const;

// Chợ F's sticky bar (wave 2): Tất cả | Mua | Thuê, quick chips for
// condition and stock that scroll sideways, sort, and "Bộ lọc" opening the
// full panel from the right. Everything goes through the page's single
// filter controller, so the bar and the drawer never disagree.
export function ShopQuickBar({
  categoryCounts,
  provinces,
  activeCount,
}: {
  categoryCounts: Record<string, number>;
  provinces: { id: string; name: string }[];
  activeCount: number;
}) {
  const t = useTranslations("publicPages.shop.filters");
  const tv = useTranslations("publicPages.shop.v2");
  const { params, navigate } = useSharedFilterParams();
  const [open, setOpen] = useState(false);

  const type = params.get("type") ?? "";
  const conditions = params.get("condition")?.split(",").filter(Boolean) ?? [];
  const inStockOnly = params.get("inStockOnly") === "true";
  const sort = params.get("sort") ?? "newest";

  const set = (key: string, value: string) =>
    navigate((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
    });

  const chip = (on: boolean) =>
    cn(
      "focus-ring shrink-0 rounded-full border px-3.5 py-1.5 text-body-sm whitespace-nowrap transition-colors duration-[var(--fg-dur-150)]",
      on
        ? "border-brand-primary bg-brand-primary text-text-on-brand"
        : "border-border-default text-text-primary hover:border-border-strong",
    );

  return (
    <div className="sticky top-[72px] z-10 -mx-4 border-y border-border-subtle bg-bg-page/95 px-4 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <div className="flex items-center gap-3">
        <div
          role="radiogroup"
          aria-label={t("type")}
          className="flex shrink-0 rounded-full border border-border-default bg-bg-surface p-0.5"
        >
          {(
            [
              ["", t("typeAll")],
              ["SALE", tv("buy")],
              ["RENT", tv("rent")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => set("type", value)}
              className={cn(
                "focus-ring rounded-full px-3.5 py-1.5 text-body-sm transition-colors duration-[var(--fg-dur-150)]",
                type === value
                  ? "bg-brand-primary font-semibold! text-text-on-brand"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CONDITIONS.map(([value, key]) => {
            const on = conditions.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set(
                    "condition",
                    (on
                      ? conditions.filter((c) => c !== value)
                      : [...conditions, value]
                    ).join(","),
                  )
                }
                className={chip(on)}
              >
                {t(key)}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={inStockOnly}
            onClick={() => set("inStockOnly", inStockOnly ? "" : "true")}
            className={chip(inStockOnly)}
          >
            {tv("inStock")}
          </button>
        </div>

        <NativeSelect
          aria-label={tv("sort")}
          className="w-48 shrink-0 max-md:hidden"
          value={sort}
          onChange={(value) => set("sort", value === "newest" ? "" : value)}
          options={[
            { value: "newest", label: t("sortNewest") },
            { value: "price_asc", label: t("sortPriceAsc") },
            { value: "price_desc", label: t("sortPriceDesc") },
          ]}
        />
        <Button
          variant="outline"
          className="shrink-0"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {tv("filters")}
          {activeCount > 0 ? (
            <span className="grid size-5 place-items-center rounded-full bg-brand-primary text-meta font-semibold text-text-on-brand">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-[88%] flex-col overflow-hidden sm:max-w-sm"
        >
          <SheetHeader>
            <SheetTitle>{tv("filters")}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <ShopFilters
              categoryCounts={categoryCounts}
              provinces={provinces}
            />
          </div>
          <div className="border-t border-border-subtle p-4">
            <Button
              variant="accent"
              className="w-full"
              onClick={() => setOpen(false)}
            >
              {tv("showResults")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
