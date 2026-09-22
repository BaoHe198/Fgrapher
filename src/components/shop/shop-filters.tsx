"use client";

import { useTranslations } from "next-intl";
import { startTransition, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NativeSelect } from "@/components/ui/native-select";
import { Radio } from "@/components/ui/radio";
import { useSharedFilterParams } from "@/components/filters/filter-params-provider";
import { setOrDelete } from "@/lib/filter-params";
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
  // One controller for every control on this panel. Each one used to build
  // its own query string from the URL the browser had committed, so a
  // control touched before the previous navigation landed silently erased
  // it — typing "Canon" and then clicking "Cho thuê" (blur and click are
  // one gesture) threw the keyword away while the box still showed it
  // (QA-02, 22/09/2026). Now every change is applied on top of the latest
  // intent instead.
  const { params, isPending, navigate, reset } = useSharedFilterParams();

  const type = params.get("type") ?? "";
  const categories = params.get("category")?.split(",").filter(Boolean) ?? [];
  const conditions = params.get("condition")?.split(",").filter(Boolean) ?? [];
  const inStockOnly = params.get("inStockOnly") === "true";
  const sort = params.get("sort") ?? "newest";
  const provinceId = params.get("provinceId") ?? "";

  const urlQuery = params.get("q") ?? "";
  const urlPriceMin = params.get("priceMin") ?? "";
  const urlPriceMax = params.get("priceMax") ?? "";

  // These three are typed into, so they keep a draft of their own between
  // keystrokes. They still have to follow the URL when it moves for a
  // reason they didn't cause — back/forward, or the reset button — which
  // they never did before: going back left "Canon" sitting in a box that
  // was no longer filtering anything.
  const [query, setQuery] = useState(urlQuery);
  const [priceMin, setPriceMin] = useState(urlPriceMin);
  const [priceMax, setPriceMax] = useState(urlPriceMax);
  const syncedRef = useRef({
    q: urlQuery,
    priceMin: urlPriceMin,
    priceMax: urlPriceMax,
  });

  useEffect(() => {
    const synced = syncedRef.current;
    if (
      synced.q === urlQuery &&
      synced.priceMin === urlPriceMin &&
      synced.priceMax === urlPriceMax
    ) {
      return;
    }
    syncedRef.current = {
      q: urlQuery,
      priceMin: urlPriceMin,
      priceMax: urlPriceMax,
    };
    startTransition(() => {
      setQuery(urlQuery);
      setPriceMin(urlPriceMin);
      setPriceMax(urlPriceMax);
    });
  }, [urlQuery, urlPriceMin, urlPriceMax]);

  const update = (mutate: (params: URLSearchParams) => void) =>
    navigate(mutate);

  // Reads the key's current values out of `next` (the latest intent) rather
  // than out of the render snapshot, so two checkboxes ticked in quick
  // succession both survive instead of the second overwriting the first.
  const toggleListValue = (key: string, value: string) => {
    update((next) => {
      const current = next.get(key)?.split(",").filter(Boolean) ?? [];
      const values = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setOrDelete(next, key, values.join(","));
    });
  };

  const applyQuery = () => {
    const trimmed = query.trim();
    if (trimmed === urlQuery) return;
    syncedRef.current = { ...syncedRef.current, q: trimmed };
    update((next) => setOrDelete(next, "q", trimmed));
  };

  return (
    <div className="flex flex-col gap-6" aria-busy={isPending}>
      {/* Submitting on Enter rather than on every keystroke: each change is a
          router.push, so typing would queue one navigation per letter. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          applyQuery();
        }}
      >
        <Input
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={applyQuery}
        />
      </form>

      <div className="flex items-center justify-between">
        <NativeSelect
          value={sort}
          onChange={(value) => update((next) => next.set("sort", value))}
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
            update((next) => setOrDelete(next, "provinceId", value))
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
          onChange={() => update((next) => next.delete("type"))}
        />
        <Radio
          label={t("typeSale")}
          checked={type === "SALE"}
          onChange={() => update((next) => next.set("type", "SALE"))}
        />
        <Radio
          label={t("typeRent")}
          checked={type === "RENT"}
          onChange={() => update((next) => next.set("type", "RENT"))}
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
            onCheckedChange={() => toggleListValue("category", category)}
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
            onCheckedChange={() => toggleListValue("condition", value)}
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
            onBlur={() => {
              if (priceMin === urlPriceMin) return;
              syncedRef.current = { ...syncedRef.current, priceMin };
              update((next) => setOrDelete(next, "priceMin", priceMin));
            }}
          />
          <span className="text-text-tertiary">–</span>
          <CurrencyInput
            placeholder={t("max")}
            value={priceMax}
            onChange={setPriceMax}
            onBlur={() => {
              if (priceMax === urlPriceMax) return;
              syncedRef.current = { ...syncedRef.current, priceMax };
              update((next) => setOrDelete(next, "priceMax", priceMax));
            }}
          />
        </div>
      </div>

      <Checkbox
        label={t("inStockOnly")}
        checked={inStockOnly}
        onCheckedChange={(checked) =>
          update((next) =>
            setOrDelete(next, "inStockOnly", checked ? "true" : ""),
          )
        }
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          syncedRef.current = { q: "", priceMin: "", priceMax: "" };
          setQuery("");
          setPriceMin("");
          setPriceMax("");
          reset();
        }}
      >
        {t("reset")}
      </Button>
    </div>
  );
}
