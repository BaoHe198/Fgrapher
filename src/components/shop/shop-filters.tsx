"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { PRODUCT_CATEGORIES } from "@/lib/validations/product";

const CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "LIKE_NEW", label: "Like new" },
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export function ShopFilters({
  categoryCounts,
}: {
  categoryCounts: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = searchParams.get("type") ?? "";
  const categories =
    searchParams.get("category")?.split(",").filter(Boolean) ?? [];
  const conditions =
    searchParams.get("condition")?.split(",").filter(Boolean) ?? [];
  const inStockOnly = searchParams.get("inStockOnly") === "true";
  const sort = searchParams.get("sort") ?? "newest";

  const [priceMin, setPriceMin] = useState(searchParams.get("priceMin") ?? "");
  const [priceMax, setPriceMax] = useState(searchParams.get("priceMax") ?? "");

  const update = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleListValue = (key: string, value: string, current: string[]) => {
    update((params) => {
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (next.length) params.set(key, next.join(","));
      else params.delete(key);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <NativeSelect
          value={sort}
          onChange={(value) => update((params) => params.set("sort", value))}
          options={SORT_OPTIONS}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          Type
        </span>
        <Radio
          label="All"
          checked={type === ""}
          onChange={() => update((params) => params.delete("type"))}
        />
        <Radio
          label="For sale"
          checked={type === "SALE"}
          onChange={() => update((params) => params.set("type", "SALE"))}
        />
        <Radio
          label="For rent"
          checked={type === "RENT"}
          onChange={() => update((params) => params.set("type", "RENT"))}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          Category
        </span>
        {PRODUCT_CATEGORIES.map((category) => (
          <Checkbox
            key={category}
            label={`${category}${categoryCounts[category] ? ` (${categoryCounts[category]})` : ""}`}
            checked={categories.includes(category)}
            onCheckedChange={() =>
              toggleListValue("category", category, categories)
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          Condition
        </span>
        {CONDITIONS.map((c) => (
          <Checkbox
            key={c.value}
            label={c.label}
            checked={conditions.includes(c.value)}
            onCheckedChange={() =>
              toggleListValue("condition", c.value, conditions)
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          Price
        </span>
        <div className="flex items-center gap-2">
          <CurrencyInput
            placeholder="Min"
            value={priceMin}
            onChange={setPriceMin}
            onBlur={() =>
              update((params) =>
                priceMin
                  ? params.set("priceMin", priceMin)
                  : params.delete("priceMin"),
              )
            }
          />
          <span className="text-text-tertiary">–</span>
          <CurrencyInput
            placeholder="Max"
            value={priceMax}
            onChange={setPriceMax}
            onBlur={() =>
              update((params) =>
                priceMax
                  ? params.set("priceMax", priceMax)
                  : params.delete("priceMax"),
              )
            }
          />
        </div>
      </div>

      <Checkbox
        label="In stock only"
        checked={inStockOnly}
        onCheckedChange={(checked) =>
          update((params) =>
            checked
              ? params.set("inStockOnly", "true")
              : params.delete("inStockOnly"),
          )
        }
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setPriceMin("");
          setPriceMax("");
          router.push(pathname);
        }}
      >
        Reset filters
      </Button>
    </div>
  );
}
