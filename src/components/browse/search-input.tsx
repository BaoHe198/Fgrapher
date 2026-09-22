"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useRef, useState } from "react";

import { useSharedFilterParams } from "@/components/filters/filter-params-provider";
import { setOrDelete } from "@/lib/filter-params";

// Long enough that typing a word is one navigation, short enough that the
// results follow the keystrokes rather than a submit.
const SEARCH_DEBOUNCE_MS = 300;

export function SearchInput({
  className,
  marketplaceEnabled,
}: {
  className?: string;
  // QA: the placeholder mentioned searching for "thiết bị" (gear) even
  // while the marketplace is off (CLAUDE.md — CAMERA_SHOP/Product listings
  // are hidden behind this flag), which promises a search capability that
  // doesn't currently do anything.
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("sharedComponents.searchInput");
  // Shared with the filter sidebar: this box used to push its own query
  // string built from the committed URL while the sidebar pushed one built
  // from a FilterState with no `q` in it, so whichever moved last erased
  // the other (QA-01).
  const { params, navigate } = useSharedFilterParams();
  const urlQuery = params.get("q") ?? "";

  const [value, setValue] = useState(urlQuery);
  // The keyword we ourselves put into the URL. Without it the effect below
  // cannot tell "our debounced push landed" from "the visitor pressed
  // back", and resyncing on the former overwrites letters typed since.
  const pushedRef = useRef(urlQuery);

  useEffect(() => {
    if (urlQuery === pushedRef.current) return;
    pushedRef.current = urlQuery;
    startTransition(() => setValue(urlQuery));
  }, [urlQuery]);

  const pushQuery = (q: string, { immediate = false } = {}) => {
    pushedRef.current = q;
    navigate((next) => setOrDelete(next, "q", q), {
      debounceMs: immediate ? 0 : SEARCH_DEBOUNCE_MS,
    });
  };

  const onChange = (next: string) => {
    setValue(next);
    pushQuery(next);
  };

  const onClear = () => {
    setValue("");
    pushQuery("", { immediate: true });
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          marketplaceEnabled ? t("placeholder") : t("placeholderNoGear")
        }
        className="h-11 w-full rounded-full border border-border-default bg-bg-surface py-2 pr-10 pl-10 text-body-md text-text-primary outline-none focus:border-border-focus focus:ring-2 focus:ring-gold-500/20"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={t("clearLabel")}
          className="absolute top-1/2 right-3.5 -translate-y-1/2 text-text-tertiary"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
