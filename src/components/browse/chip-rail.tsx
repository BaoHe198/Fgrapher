"use client";

import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface ChipRailItem {
  value: string;
  label: string;
}

// A row of single-choice 44px chips that scrolls sideways (Core MVP pass,
// 02/10/2026). When it can scroll, a fade and a 44px arrow on the right say
// so; once scrolled, a fade appears on the left too; at the end the arrow
// goes. Shared by Tìm kiếm F's and Bản đồ F's role rails.
export function ChipRail({
  items,
  value,
  onPick,
  label,
  moreLabel,
  className,
}: {
  items: ChipRailItem[];
  value: string;
  onPick: (value: string) => void;
  /** The group's accessible name. */
  label: string;
  /** The scroll arrow's accessible name. */
  moreLabel: string;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

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

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={scroller}
        role="group"
        aria-label={label}
        onScroll={measure}
        className="flex snap-x gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const on = item.value === value;
          return (
            <button
              key={item.value || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(item.value)}
              className={cn(
                "focus-ring min-h-11 shrink-0 snap-start rounded-full border px-4 text-body-sm font-semibold whitespace-nowrap transition-colors duration-[var(--fg-dur-150)]",
                on
                  ? "border-brand-primary bg-brand-primary text-text-on-brand"
                  : "border-border-default bg-bg-surface text-text-primary hover:border-border-strong",
              )}
            >
              {item.label}
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
            aria-label={moreLabel}
            className="focus-ring pointer-events-auto grid size-11 place-items-center rounded-full border border-border-default bg-bg-surface text-text-primary shadow-[var(--shadow-sm)]"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </span>
      ) : null}
    </div>
  );
}
