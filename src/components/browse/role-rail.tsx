"use client";

import type { Role } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSharedFilterParams } from "@/components/filters/filter-params-provider";
import { cn } from "@/lib/utils";

// Tìm kiếm F's role rail (Core MVP pass, 02/10/2026): "Tất cả" plus the six
// roles as plain 44px chips - no thumbnails, no frame numbers. Styles live
// in the filter sheet. When it can scroll, a fade and a 44px arrow on the
// right say so; once scrolled, a fade appears on the left too; at the end
// the arrow goes.
export function RoleRail({ roles }: { roles: Role[] }) {
  const t = useTranslations("publicPages.browse.v3");
  const railT = useTranslations("publicPages.browse.v3.railRoles");
  const { params, navigate } = useSharedFilterParams();
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const selected = params.get("roles")?.split(",").filter(Boolean) ?? [];
  const current = selected.length === 1 ? selected[0] : "";

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const pick = (role: string) =>
    navigate((next) => {
      if (role) next.set("roles", role);
      else next.delete("roles");
      // A style belongs to a role; switching role drops it.
      next.delete("categories");
      next.delete("page");
    });

  const more = () => {
    const el = scroller.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({
      left: Math.round(el.clientWidth * 0.6),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const chips = [
    { value: "", label: t("allRoles") },
    ...roles.map((role) => ({
      value: role,
      label: railT(role as "STUDIO"),
    })),
  ];

  return (
    <div className="relative min-w-0">
      <div
        ref={scroller}
        role="group"
        aria-label={t("roleRail")}
        onScroll={measure}
        className="flex snap-x gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((chip) => {
          const on = chip.value === current;
          return (
            <button
              key={chip.value || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => pick(chip.value)}
              className={cn(
                "focus-ring min-h-11 shrink-0 snap-start rounded-full border px-4 text-body-sm font-semibold whitespace-nowrap transition-colors duration-[var(--fg-dur-150)]",
                on
                  ? "border-brand-primary bg-brand-primary text-text-on-brand"
                  : "border-border-default bg-bg-surface text-text-primary hover:border-border-strong",
              )}
            >
              {chip.label}
            </button>
          );
        })}
        {edges.right || edges.left ? (
          <span aria-hidden className="w-10 shrink-0" />
        ) : null}
      </div>
      {edges.left ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-bg-page from-20% to-transparent"
        />
      ) : null}
      {edges.right ? (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-[84px] items-center justify-end bg-linear-to-l from-bg-page from-50% to-transparent pr-0.5">
          <button
            type="button"
            onClick={more}
            aria-label={t("moreRoles")}
            className="focus-ring pointer-events-auto grid size-11 place-items-center rounded-full border border-border-default bg-bg-surface text-text-primary shadow-[var(--shadow-sm)]"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </span>
      ) : null}
    </div>
  );
}
