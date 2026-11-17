"use client";

import type { Role } from "@prisma/client";
import { Camera, LayoutGrid, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useHomeFilter } from "@/components/home/home-filter";
import {
  ProvincePicker,
  ROLE_ICONS,
  ServicePicker,
} from "@/components/home/search-pickers";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import { vietnamDateKey } from "@/lib/vietnam/date";

// The top of the home page, Airbnb-style (owner, 17/11/2026): a row of
// service tabs that filter the home page in place (see home-filter.tsx),
// then one pill - where, when, which service - and a round
// search button. It lands on Tìm kiếm F with the same parameters that page
// already reads (city, date, roles), so nothing new is invented on either
// side. Provinces come from the registry passed in, never a list in code.
export function HomeSearch({
  provinces,
  roles,
  activeRole,
}: {
  provinces: { code: string; name: string }[];
  roles: Role[];
  /** The tab the page is showing (from /?role=), or null for Tất cả. */
  activeRole: Role | null;
}) {
  const t = useTranslations("home.search");
  const roleT = useTranslations("role");
  const router = useRouter();
  const { selectRole } = useHomeFilter();
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [role, setRole] = useState<string>(activeRole ?? "");
  // The tab lights up on the tap, before the new rows arrive; it follows the
  // page again whenever the URL's role changes (back button, a shared link).
  const [tab, setTab] = useState<Role | null>(activeRole);
  const [lastActive, setLastActive] = useState(activeRole);
  if (activeRole !== lastActive) {
    setLastActive(activeRole);
    setTab(activeRole);
    setRole(activeRole ?? "");
  }

  const pick = (next: Role | null) => {
    setTab(next);
    setRole(next ?? "");
    selectRole(next);
  };

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

  return (
    <div className="flex flex-col items-center gap-6">
      <nav aria-label={t("tabsLabel")} className="w-full">
        <ul className="mx-auto flex w-fit max-w-full gap-6 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:gap-9 [&::-webkit-scrollbar]:hidden">
          {([null, ...roles] as (Role | null)[]).map((r) => {
            const Icon = r ? (ROLE_ICONS[r] ?? Camera) : LayoutGrid;
            const active = r === tab;
            return (
              <li key={r ?? "all"} className="shrink-0">
                <Link
                  href={r ? `/?role=${r}` : "/"}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    // Plain clicks filter in place; a modified click (new
                    // tab, new window) still follows the real link.
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
                      return;
                    e.preventDefault();
                    if (!active) pick(r);
                  }}
                  className={cn(
                    "group/tab focus-ring flex flex-col items-center gap-1.5 pb-2 transition-colors duration-[var(--fg-dur-150)]",
                    active
                      ? "text-text-primary"
                      : "text-text-secondary hover:text-text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-full transition-[transform,background-color,color] duration-[var(--fg-dur-260)] ease-fg-out group-hover/tab:scale-110 motion-reduce:group-hover/tab:scale-100",
                      active
                        ? "bg-gold-50 text-gold-600 dark:bg-gold-900/40 dark:text-gold-300"
                        : "bg-bg-sunken text-text-primary",
                    )}
                  >
                    <Icon aria-hidden className="size-6" />
                  </span>
                  <span
                    className={cn(
                      "border-b-2 pb-1 text-body-sm whitespace-nowrap transition-colors duration-[var(--fg-dur-150)]",
                      active
                        ? "border-text-primary font-semibold!"
                        : "border-transparent group-hover/tab:border-border-strong",
                    )}
                  >
                    {r ? roleT(r) : t("all")}
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
        <ProvincePicker provinces={provinces} value={city} onChange={setCity} />
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
        <ServicePicker roles={roles} value={role} onChange={setRole} />
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
