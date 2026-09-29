"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Sticky in-page navigation (system audit 09/2026 §05): the profile's
// section bar, reusable for "Giới thiệu F". It highlights the section being
// read as the page scrolls, jumps to a section on click, and scrolls
// sideways on a phone with the active item kept in view. The underline
// slides with the in-out curve.

interface SectionNavItem {
  id: string;
  label: string;
}

interface SectionNavProps {
  items: SectionNavItem[];
  /** Height of whatever sits above the bar (site header), in px - used
   * for the scroll maths. Keep it in step with `topClassName`. */
  offset?: number;
  /** Sticky `top` as a Tailwind class, matching `offset`. */
  topClassName?: string;
  /** Force the active item instead of tracking scroll. */
  activeId?: string;
  label: string;
  className?: string;
}

const BAR_HEIGHT = 52;

function SectionNav({
  items,
  offset = 64,
  topClassName = "top-16",
  activeId,
  label,
  className,
}: SectionNavProps) {
  const [tracked, setTracked] = React.useState(items[0]?.id);
  const current = activeId ?? tracked;
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (activeId !== undefined) return;
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node !== null);
    if (sections.length === 0 || typeof IntersectionObserver === "undefined")
      return;

    // A section counts as "being read" once its top passes just under the
    // bar; the band is thin so exactly one section wins at a time.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setTracked(visible[0].target.id);
      },
      {
        rootMargin: `-${offset + BAR_HEIGHT + 8}px 0px -60% 0px`,
        threshold: 0,
      },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items, offset, activeId]);

  // Keep the active item visible in the horizontally scrolling phone bar.
  React.useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !active) return;
    const left = active.offsetLeft - 20;
    const right = active.offsetLeft + active.offsetWidth + 20;
    if (left < list.scrollLeft) list.scrollTo({ left, behavior: "smooth" });
    else if (right > list.scrollLeft + list.clientWidth)
      list.scrollTo({ left: right - list.clientWidth, behavior: "smooth" });
  }, [current]);

  const jump = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const top =
      target.getBoundingClientRect().top + window.scrollY - offset - BAR_HEIGHT;
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    history.replaceState(null, "", `#${id}`);
    setTracked(id);
  };

  return (
    <nav
      aria-label={label}
      data-slot="section-nav"
      className={cn(
        "sticky z-30 border-b border-border-subtle bg-bg-page/95 backdrop-blur supports-[backdrop-filter]:bg-bg-page/80",
        topClassName,
        className,
      )}
    >
      <ul
        ref={listRef}
        className="flex h-[52px] items-stretch gap-6 overflow-x-auto px-5 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const active = item.id === current;
          return (
            <li key={item.id} className="flex shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={active ? "true" : undefined}
                onClick={(event) => jump(event, item.id)}
                className={cn(
                  "focus-ring relative flex items-center text-body-sm whitespace-nowrap transition-colors duration-[var(--fg-dur-150)]",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:bg-brand-primary after:transition-transform after:duration-[var(--fg-dur-260)] after:ease-fg-in-out",
                  active
                    ? "font-semibold! text-text-primary after:scale-x-100"
                    : "text-text-secondary after:scale-x-0 hover:text-text-primary",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { SectionNav };
export type { SectionNavItem };
