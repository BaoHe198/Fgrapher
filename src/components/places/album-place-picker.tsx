"use client";

import { Loader2, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface PickedPlace {
  id: string;
  name: string;
}

interface Option extends PickedPlace {
  provinceName: string;
}

/**
 * "Chụp tại" on an album: search approved photo spots by name (accents
 * optional) and pick one. A combobox: the list follows the typing, arrow
 * keys move through it, Enter picks.
 */
export function AlbumPlacePicker({
  value,
  onChange,
}: {
  value: PickedPlace | null;
  onChange: (place: PickedPlace | null) => void;
}) {
  const t = useTranslations("places.albumPicker");
  const inputId = useId();
  const listId = useId();
  const hintId = useId();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = window.setTimeout(() => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);
      fetch(`/api/places/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((body) => {
          setOptions(body.data ?? []);
          setActive(0);
          setLoading(false);
        })
        .catch(() => {});
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const pick = (option: Option) => {
    onChange({ id: option.id, name: option.name });
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-body-sm font-semibold! text-text-primary"
      >
        {t("label")}
      </label>
      <p id={hintId} className="text-body-sm text-text-tertiary">
        {t("hint")}
      </p>
      {value ? (
        <div className="flex items-center gap-2 rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3 py-2">
          <MapPin aria-hidden className="size-4 shrink-0 text-text-secondary" />
          <span className="min-w-0 flex-1 truncate text-body-md text-text-primary">
            {value.name}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("clear")}
            className="focus-ring flex size-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-sunken"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div>
          <input
            id={inputId}
            role="combobox"
            aria-expanded={open && query.trim() !== ""}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-describedby={hintId}
            aria-activedescendant={
              open && options[active] ? `${listId}-${active}` : undefined
            }
            autoComplete="off"
            value={query}
            placeholder={t("placeholder")}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && open && options[active]) {
                e.preventDefault();
                pick(options[active]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className="h-11 w-full rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface px-3 text-body-md text-text-primary outline-none placeholder:text-text-tertiary focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus/30"
          />
          {open && query.trim() !== "" && !value ? (
            // In the flow rather than floating: inside a dialog that scrolls,
            // a floating list at the bottom was cut off by the dialog's edge.
            <div className="mt-1 overflow-hidden rounded-[var(--fg-radius-md)] border border-border-default bg-bg-surface shadow-[var(--shadow-sm)]">
              {loading ? (
                <p className="flex items-center gap-2 px-3 py-2.5 text-body-sm text-text-secondary">
                  <Loader2 className="size-4 animate-spin" />
                  {t("loading")}
                </p>
              ) : options.length === 0 ? (
                <div className="flex flex-col gap-1 px-3 py-2.5">
                  <p className="text-body-sm text-text-secondary">
                    {t("none")}
                  </p>
                  <Link
                    href="/dashboard/places/new"
                    className="text-body-sm font-semibold text-text-link hover:underline"
                  >
                    {t("propose")}
                  </Link>
                </div>
              ) : null}
              <ul
                id={listId}
                role="listbox"
                className={cn(loading && "hidden")}
              >
                {options.map((option, index) => (
                  <li
                    key={option.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(option);
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex cursor-pointer flex-col px-3 py-2",
                      index === active && "bg-bg-sunken",
                    )}
                  >
                    <span className="text-body-md text-text-primary">
                      {option.name}
                    </span>
                    <span className="text-body-sm text-text-tertiary">
                      {option.provinceName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
