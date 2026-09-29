"use client";

import { useTranslations } from "next-intl";

import { NativeSelect } from "@/components/ui/native-select";
import { useSharedFilterParams } from "@/components/filters/filter-params-provider";
import {
  readBrowseFilters,
  writeBrowseFilters,
} from "@/lib/search/browse-filters";

// Sort, above the results on a desktop (redesign 09/2026). Goes through the
// shared filter controller like every other control, so it keeps the rest
// of the query - keyword, filters, tab - and resets to the first page.
export function SortSelect({ className }: { className?: string }) {
  const t = useTranslations("sharedComponents.filterSidebar");
  const { params, navigate } = useSharedFilterParams();
  const sort = readBrowseFilters(params).sort;
  return (
    <NativeSelect
      aria-label={t("sortByLabel")}
      className={className}
      value={sort}
      onChange={(value) =>
        navigate((next) => {
          writeBrowseFilters(next, { ...readBrowseFilters(next), sort: value });
          next.delete("page");
        })
      }
      options={[
        { value: "rating", label: t("sortTopRated") },
        { value: "price_asc", label: t("sortPriceAsc") },
        { value: "price_desc", label: t("sortPriceDesc") },
        { value: "newest", label: t("sortNewest") },
        { value: "reviews", label: t("sortMostReviewed") },
      ]}
    />
  );
}
