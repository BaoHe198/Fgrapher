"use client";

import type { Role } from "@prisma/client";
import {
  Building2,
  Camera,
  LayoutGrid,
  Palette,
  Search,
  Shirt,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DateField } from "@/components/ui/date-field";
import { vietnamDateKey } from "@/lib/vietnam/date";

const TAB_ICONS: Partial<Record<Role, LucideIcon>> = {
  PHOTOGRAPHER: Camera,
  VIDEOGRAPHER: Video,
  MAKEUP_ARTIST: Palette,
  MODEL: UserRound,
  STUDIO: Building2,
  COSTUME_SHOP: Shirt,
};

// The top of the home page, Airbnb-style (owner, 17/11/2026): a row of
// service tabs, then one pill - where, when, which service - and a round
// search button. It lands on Tìm kiếm F with the same parameters that page
// already reads (city, date, roles), so nothing new is invented on either
// side. Provinces come from the registry passed in, never a list in code.
export function HomeSearch({
  provinces,
  roles,
}: {
  provinces: { code: string; name: string }[];
  roles: Role[];
}) {
  const t = useTranslations("home.search");
  const roleT = useTranslations("role");
  const router = useRouter();
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [role, setRole] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (date) params.set("date", date);
    if (role) params.set("roles", role);
    const query = params.toString();
    router.push(`/browse${query ? `?${query}` : ""}`);
  };

  const field =
    "flex min-w-0 flex-1 flex-col gap-0.5 rounded-full px-6 py-3 text-left transition-colors duration-[var(--fg-dur-150)] hover:bg-bg-sunken focus-within:bg-bg-sunken max-md:rounded-[var(--fg-radius-lg)] max-md:px-4";
  const label = "text-meta font-semibold! text-text-primary";
  const control =
    "w-full min-w-0 cursor-pointer bg-transparent text-body-sm text-text-secondary outline-none";

  return (
    <div className="flex flex-col items-center gap-6">
      <nav aria-label={t("tabsLabel")} className="w-full">
        <ul className="mx-auto flex w-fit max-w-full gap-6 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:gap-9 [&::-webkit-scrollbar]:hidden">
          <li className="shrink-0">
            <Link
              href="/browse"
              className="group/tab focus-ring flex flex-col items-center gap-1.5 pb-2 text-text-primary"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-gold-50 text-gold-600 transition-transform duration-[var(--fg-dur-260)] ease-fg-out group-hover/tab:scale-110 dark:bg-gold-900/40 dark:text-gold-300">
                <LayoutGrid aria-hidden className="size-6" />
              </span>
              <span className="border-b-2 border-text-primary pb-1 text-body-sm font-semibold!">
                {t("all")}
              </span>
            </Link>
          </li>
          {roles.map((r) => {
            const Icon = TAB_ICONS[r] ?? Camera;
            return (
              <li key={r} className="shrink-0">
                <Link
                  href={`/browse?roles=${r}`}
                  className="group/tab focus-ring flex flex-col items-center gap-1.5 pb-2 text-text-secondary hover:text-text-primary"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-bg-sunken text-text-primary transition-transform duration-[var(--fg-dur-260)] ease-fg-out group-hover/tab:scale-110">
                    <Icon aria-hidden className="size-6" />
                  </span>
                  <span className="border-b-2 border-transparent pb-1 text-body-sm whitespace-nowrap group-hover/tab:border-border-strong">
                    {roleT(r)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form
        role="search"
        aria-label={t("label")}
        onSubmit={submit}
        className="flex w-full max-w-[850px] items-center gap-1 rounded-full border border-border-subtle bg-bg-surface p-2 shadow-[0_6px_24px_-8px_hsl(264_40%_14%/0.25)] max-md:flex-col max-md:items-stretch max-md:rounded-[var(--fg-radius-xl)]"
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
          <DateField
            value={date}
            onChange={setDate}
            min={vietnamDateKey()}
            aria-label={t("when")}
            className="[&_input]:h-auto [&_input]:rounded-none [&_input]:border-0 [&_input]:bg-transparent [&_input]:px-0 [&_input]:py-0 [&_input]:text-body-sm [&_input]:text-text-secondary [&_input]:shadow-none [&_input]:focus-visible:ring-0 [&_input]:focus-visible:outline-none"
          />
        </div>
        <span aria-hidden className="h-8 w-px bg-border-subtle max-md:hidden" />
        <label className={field}>
          <span className={label}>{t("what")}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={control}
          >
            <option value="">{t("anyService")}</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleT(r)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          aria-label={t("submit")}
          className="focus-ring flex size-12 shrink-0 items-center justify-center gap-2 rounded-full bg-gold-400 text-white transition-[background-color,transform] duration-[var(--fg-dur-150)] hover:bg-gold-500 active:scale-95 max-md:h-12 max-md:w-full"
        >
          <Search aria-hidden className="size-5" />
          <span className="font-semibold uppercase tracking-[0.04em] md:sr-only">
            {t("submit")}
          </span>
        </button>
      </form>
    </div>
  );
}
