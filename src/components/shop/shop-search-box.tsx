"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useRef, useState } from "react";

import { useSharedFilterParams } from "@/components/filters/filter-params-provider";
import { Input } from "@/components/ui/input";
import { setOrDelete } from "@/lib/search/filter-params";
import { cn } from "@/lib/utils";

// Chợ F's keyword box, right in the sticky bar (owner, 16/11/2026: it used
// to sit inside the "Bộ lọc" drawer, out of sight). It goes through the
// page's single filter controller like every other control, so a keyword
// typed and then a chip pressed in one gesture both survive (QA-02).
export function ShopSearchBox({ className }: { className?: string }) {
  const t = useTranslations("publicPages.shop.filters");
  const { params, navigate } = useSharedFilterParams();
  const urlQuery = params.get("q") ?? "";

  // A draft of its own between keystrokes, which still follows the URL when
  // it moves for a reason the box didn't cause (back/forward, "Xóa tất cả").
  const [query, setQuery] = useState(urlQuery);
  const synced = useRef(urlQuery);
  useEffect(() => {
    if (synced.current === urlQuery) return;
    synced.current = urlQuery;
    startTransition(() => setQuery(urlQuery));
  }, [urlQuery]);

  const apply = () => {
    const trimmed = query.trim();
    if (trimmed === urlQuery) return;
    synced.current = trimmed;
    navigate((next) => {
      setOrDelete(next, "q", trimmed);
      next.delete("page");
    });
  };

  // Submitting on Enter (or leaving the box) rather than on every keystroke:
  // each change is a router.push, so typing would queue one per letter.
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary"
      />
      <Input
        type="search"
        enterKeyHint="search"
        aria-label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={apply}
        className="pl-9"
      />
    </form>
  );
}
