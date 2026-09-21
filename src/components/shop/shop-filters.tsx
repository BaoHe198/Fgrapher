"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { PRODUCT_CATEGORIES } from "@/lib/validations/product";

const CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR"] as const;
const SORT_VALUES = ["newest", "price_asc", "price_desc"] as const;

const CONDITION_KEY: Record<(typeof CONDITIONS)[number], string> = {
  NEW: "conditionNew",
  LIKE_NEW: "conditionLikeNew",
  GOOD: "conditionGood",
  FAIR: "conditionFair",
};

const SORT_KEY: Record<(typeof SORT_VALUES)[number], string> = {
  newest: "sortNewest",
  price_asc: "sortPriceAsc",
  price_desc: "sortPriceDesc",
};

export function ShopFilters({
  categoryCounts,
  provinces,
}: {
  categoryCounts: Record<string, number>;
  provinces: { id: string; name: string }[];
}) {
  const t = useTranslations("publicPages.shop.filters");
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
  const provinceId = searchParams.get("provinceId") ?? "";

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
          options={SORT_VALUES.map((value) => ({
            value,
            label: t(SORT_KEY[value]),
          }))}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("province")}
        </span>
        <NativeSelect
          value={provinceId}
          onChange={(value) =>
            update((params) =>
              value
                ? params.set("provinceId", value)
                : params.delete("provinceId"),
            )
          }
          options={[
            { value: "", label: t("provinceAll") },
            ...provinces.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("type")}
        </span>
        <Radio
          label={t("typeAll")}
          checked={type === ""}
          onChange={() => update((params) => params.delete("type"))}
        />
        <Radio
          label={t("typeSale")}
          checked={type === "SALE"}
          onChange={() => update((params) => params.set("type", "SALE"))}
        />
        <Radio
          label={t("typeRent")}
          checked={type === "RENT"}
          onChange={() => update((params) => params.set("type", "RENT"))}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("category")}
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
          {t("condition")}
        </span>
        {CONDITIONS.map((value) => (
          <Checkbox
            key={value}
            label={t(CONDITION_KEY[value])}
            checked={conditions.includes(value)}
            onCheckedChange={() =>
              toggleListValue("condition", value, conditions)
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("price")}
        </span>
        <div className="flex items-center gap-2">
          <CurrencyInput
            placeholder={t("min")}
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
            placeholder={t("max")}
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
        label={t("inStockOnly")}
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
        {t("reset")}
      </Button>
    </div>
  );
}
