"use client";

import { Check, Loader2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddressPoint {
  latitude: number;
  longitude: number;
}

interface Suggestion extends AddressPoint {
  id: string;
  label: string;
}

interface AddressAutocompleteProps {
  label: string;
  placeholder?: string;
  value: string;
  /** Point of the suggestion the provider picked, or null once they edit. */
  point: AddressPoint | null;
  provinceId: string;
  wardId: string;
  /** Ward/province names, stripped from a picked suggestion's label. */
  areaNames: string[];
  onChange: (address: string, point: AddressPoint | null) => void;
}

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

// House/alley number as typed, e.g. "12", "12A", "134/5B".
const HOUSE_NUMBER = /^\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)*\b/;
// A trailing administrative segment of a MapTiler label, with or without
// its postcode: "71006 Phường Sài Gòn", "Thành phố Hồ Chí Minh", "Việt Nam".
const AREA_SEGMENT =
  /^(?:\d{5,6}\s+)?(?:phường|xã|thị trấn|quận|huyện|thị xã|thành phố|tỉnh|đặc khu)\b/i;
// The ward a suggestion sits in, used to flag a mismatch with the form.
const WARD_IN_LABEL = /(?:phường|xã|thị trấn)\s+[^,]+/i;

/**
 * "12 Nguyễn Huệ, Phường Sài Gòn, Hồ Chí Minh, Việt Nam" -> "12 Nguyễn Huệ":
 * ward and province have their own fields, so only the street part belongs
 * in the detailed-address box. MapTiler usually answers at street level
 * ("Võ Văn Ngân, 70000 Phường Thủ Đức"), so the house number the provider
 * typed is kept in front of it.
 */
function streetPart(label: string, areaNames: string[], typed: string) {
  const areas = areaNames.map((name) => name.toLowerCase());
  const parts = label.split(",").map((part) => part.trim());
  while (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase();
    const isArea =
      last === "việt nam" ||
      last === "vietnam" ||
      AREA_SEGMENT.test(last) ||
      areas.some((area) => area.includes(last) || last.includes(area));
    if (!isArea) break;
    parts.pop();
  }
  const street = parts.join(", ");
  const houseNumber = typed.trim().match(HOUSE_NUMBER)?.[0];
  return houseNumber && !HOUSE_NUMBER.test(street)
    ? `${houseNumber} ${street}`
    : street;
}

/**
 * Detailed-address field with MapTiler suggestions (via our own
 * /api/geocoding/suggest, so the key stays server-side). Picking a
 * suggestion hands its exact point to the form, which is what places the
 * provider's Fmap marker; typing freely still works and falls back to
 * geocoding the text on save.
 */
export function AddressAutocomplete({
  label,
  placeholder,
  value,
  point,
  provinceId,
  wardId,
  areaNames,
  onChange,
}: AddressAutocompleteProps) {
  const t = useTranslations("dashboardSettings.profile.location");
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState("");
  const [otherWard, setOtherWard] = useState<string | null>(null);
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH || unavailable) {
      startTransition(() => setSuggestions([]));
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim() });
      if (wardId) params.set("wardId", wardId);
      else if (provinceId) params.set("provinceId", provinceId);
      startTransition(() => setLoading(true));
      fetch(`/api/geocoding/suggest?${params}`, { signal: controller.signal })
        .then(async (response) => {
          const body = (await response.json()) as {
            data: Suggestion[] | null;
            error: string | null;
          };
          startTransition(() => {
            if (response.status === 503) setUnavailable(true);
            setSuggestions(response.ok ? (body.data ?? []) : []);
            setActiveIndex(-1);
            setOpen(true);
          });
        })
        .catch(() => {})
        .finally(() => startTransition(() => setLoading(false)));
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, provinceId, wardId, unavailable]);

  const pick = (suggestion: Suggestion) => {
    // MapTiler can answer with a street in a different ward; the marker
    // would then sit outside the ward the provider selected above.
    const labelWard = suggestion.label.match(WARD_IN_LABEL)?.[0].trim();
    const selectedWard = areaNames[1]?.trim().toLowerCase();
    setOtherWard(
      labelWard &&
        selectedWard &&
        !labelWard.toLowerCase().includes(selectedWard)
        ? labelWard
        : null,
    );
    onChange(streetPart(suggestion.label, areaNames, value), {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setOpen(false);
    setSuggestions([]);
  };

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
        onChange={(event) => {
          // Any manual edit invalidates the picked point.
          setOtherWard(null);
          onChange(event.target.value, null);
          setQuery(event.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(event) => {
          if (!showList) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) =>
              index <= 0 ? suggestions.length - 1 : index - 1,
            );
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            pick(suggestions[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface p-1 shadow-[var(--shadow-lg)]"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                // Keep focus in the input so onBlur doesn't close the list
                // before the click lands.
                event.preventDefault();
                if (blurTimer.current) window.clearTimeout(blurTimer.current);
                pick(suggestion);
              }}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-[var(--fg-radius-sm)] px-2 py-2 text-body-sm text-text-primary hover:bg-bg-sunken",
                index === activeIndex && "bg-bg-sunken",
              )}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
              <span>{suggestion.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p
        className={cn(
          "mt-1.5 flex items-center gap-1.5 text-body-sm",
          point ? "text-success" : "text-text-tertiary",
        )}
        aria-live="polite"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : point ? (
          <Check className="size-3.5" />
        ) : null}
        {point
          ? otherWard
            ? t("addressOtherWard", { ward: otherWard })
            : t("addressPinned")
          : unavailable
            ? t("addressSuggestUnavailable")
            : t("addressSuggestHint")}
      </p>
    </div>
  );
}
