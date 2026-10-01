"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useSharedFilterParams } from "@/components/filters/filter-params-provider";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { vietnamDateKey } from "@/lib/vietnam/date";

// Hours a shoot can start at in the pill, 06:00-18:00. A start time asks for
// a two-hour window, the usual length of one session; the filter drawer
// still offers any from-to window.
const START_HOURS = ["06:00", "08:00", "10:00", "14:00", "16:00", "18:00"];
const WINDOW_HOURS = 2;

function endOf(start: string) {
  const hour = Math.min(21, Number(start.slice(0, 2)) + WINDOW_HOURS);
  return `${String(hour).padStart(2, "0")}:00`;
}

// Tìm kiếm F v2's search pill: where and when, then Tìm. Province is the
// real registry passed in by the page, never a list in code. Writes through
// the page's single filter controller, so the drawer and chips stay in step.
export function BrowseSearchPill({
  provinces,
}: {
  provinces: { code: string; name: string }[];
}) {
  const t = useTranslations("publicPages.browseV2.pill");
  const { params, navigate } = useSharedFilterParams();
  const [city, setCity] = useState(params.get("city") ?? "");
  const [date, setDate] = useState(params.get("date") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate((next) => {
      for (const [key, value] of [
        ["city", city],
        ["date", date],
        ["from", date && from ? from : ""],
        ["to", date && from ? endOf(from) : ""],
      ] as const) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (city !== (params.get("city") ?? "")) next.delete("ward");
      next.delete("page");
    });
  };

  const field =
    "flex min-w-0 flex-1 flex-col gap-0.5 rounded-full px-5 py-2.5 focus-within:bg-bg-sunken max-md:rounded-[var(--fg-radius-md)] max-md:px-4";
  const label =
    "text-meta font-semibold tracking-[0.12em] text-text-tertiary uppercase";
  const control =
    "w-full min-w-0 bg-transparent text-body-md text-text-primary outline-none";

  return (
    <form
      role="search"
      aria-label={t("label")}
      onSubmit={submit}
      className="mx-auto flex w-full max-w-3xl items-center gap-1 rounded-full border border-border-default bg-bg-surface p-1.5 shadow-[var(--shadow-sm)] max-md:flex-col max-md:items-stretch max-md:rounded-[var(--fg-radius-lg)]"
    >
      <label className={field}>
        <span className={label}>{t("where")}</span>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={control}
        >
          <option value="">{t("anywhere")}</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <span aria-hidden className="h-8 w-px bg-border-subtle max-md:hidden" />
      <div className={field}>
        <span className={label}>{t("when")}</span>
        <div className="flex items-center gap-2">
          <DateField
            aria-label={t("date")}
            value={date}
            min={vietnamDateKey()}
            onChange={setDate}
            className="min-w-0 flex-1 [&_input]:h-auto [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:shadow-none"
          />
          <select
            aria-label={t("time")}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={!date}
            className="shrink-0 bg-transparent text-body-sm text-text-secondary outline-none disabled:opacity-50"
          >
            <option value="">{t("anyTime")}</option>
            {START_HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="shrink-0 rounded-full max-md:rounded-[var(--fg-radius-md)]"
      >
        <Search aria-hidden className="size-4" />
        {t("submit")}
      </Button>
    </form>
  );
}
