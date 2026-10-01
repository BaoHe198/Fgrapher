"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

// A photo grid that never crops (wave 2 kit §03): the photographer framed
// the shot, so every photo keeps its own ratio. Photos go, in the order the
// artist set, into whichever column is shortest - heights come from the
// stored width/height, so the page does not jump as images arrive. The
// contact-sheet mode puts every frame in an equal square cell (contained,
// never cropped) with a mono frame number under it: 6 frames to a roll,
// 01A…01F, 02A… The chosen mode is remembered per viewer.

export interface MasonryItem {
  id: string;
  src: string;
  width?: number | null;
  height?: number | null;
  alt: string;
}

type Mode = "masonry" | "contact";

interface MasonryGridProps {
  items: MasonryItem[];
  onOpen?: (index: number) => void;
  /** Show the "Bố cục gốc / Contact sheet" switch above the grid. */
  showModeSwitch?: boolean;
  defaultMode?: Mode;
  /** Remembers the mode per viewer under this key. */
  storageKey?: string;
  /** Overlay drawn on each photo (name and price in Tìm kiếm F). */
  renderOverlay?: (item: MasonryItem, index: number) => React.ReactNode;
  sizes?: string;
  className?: string;
}

export function frameLabel(index: number) {
  const roll = String(Math.floor(index / 6) + 1).padStart(2, "0");
  return `${roll}${"ABCDEF"[index % 6]}`;
}

// Literal classes so Tailwind generates them: the first roll develops in
// one after another, the rest simply appear.
const DEVELOP_DELAY = [
  "",
  "[animation-delay:60ms]",
  "[animation-delay:120ms]",
  "[animation-delay:180ms]",
  "[animation-delay:240ms]",
  "[animation-delay:300ms]",
];

function columnsFor(width: number) {
  if (width < 480) return 2;
  if (width < 900) return 3;
  return 4;
}

export function MasonryGrid({
  items,
  onOpen,
  showModeSwitch = false,
  defaultMode = "masonry",
  storageKey,
  renderOverlay,
  sizes = "(min-width: 900px) 25vw, (min-width: 480px) 33vw, 50vw",
  className,
}: MasonryGridProps) {
  const t = useTranslations("uiKit.masonry");
  const [mode, setMode] = React.useState<Mode>(defaultMode);
  const [columns, setColumns] = React.useState(3);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "masonry" || saved === "contact")
        React.startTransition(() => setMode(saved));
    } catch {
      // Storage blocked: keep the default.
    }
  }, [storageKey]);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setColumns(columnsFor(node.clientWidth));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const changeMode = (next: Mode) => {
    setMode(next);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Not remembered; fine.
    }
  };

  // Shortest-column placement, keeping each photo's index for the lightbox
  // and its frame number.
  const placed = React.useMemo(() => {
    const cols: { item: MasonryItem; index: number }[][] = Array.from(
      { length: columns },
      () => [],
    );
    const heights = new Array(columns).fill(0);
    items.forEach((item, index) => {
      const ratio = item.width && item.height ? item.height / item.width : 1.25;
      const target = heights.indexOf(Math.min(...heights));
      cols[target].push({ item, index });
      heights[target] += ratio;
    });
    return cols;
  }, [items, columns]);

  const tile = (item: MasonryItem, index: number, contact: boolean) => (
    <button
      key={item.id}
      type="button"
      data-interactive="true"
      onClick={() => onOpen?.(index)}
      aria-label={t("open", { frame: frameLabel(index) })}
      className={cn(
        "group/tile focus-ring relative block w-full overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken text-left",
        contact && "aspect-square",
      )}
    >
      <Image
        src={item.src}
        alt={item.alt}
        width={item.width ?? 800}
        height={item.height ?? 1000}
        sizes={sizes}
        className={cn(
          contact ? "size-full object-contain" : "h-auto w-full",
          index < 6 && ["animate-develop", DEVELOP_DELAY[index]],
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_var(--fg-image-ring)]"
      />
      {renderOverlay?.(item, index)}
    </button>
  );

  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      data-slot="masonry-grid"
    >
      {showModeSwitch ? (
        <div
          role="radiogroup"
          aria-label={t("modeLabel")}
          className="flex w-fit rounded-full border border-border-default p-0.5"
        >
          {(["masonry", "contact"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => changeMode(value)}
              className={cn(
                "focus-ring rounded-full px-3.5 py-1.5 text-body-sm transition-colors duration-[var(--fg-dur-150)]",
                mode === value
                  ? "bg-brand-primary font-semibold! text-text-on-brand"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {t(value)}
            </button>
          ))}
        </div>
      ) : null}

      <div ref={ref}>
        {mode === "contact" ? (
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-2 gap-y-3 md:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] md:gap-x-3">
            {items.map((item, index) => (
              <li key={item.id} className="flex flex-col gap-1">
                {tile(item, index, true)}
                <span className="font-mono text-meta tracking-[0.12em] text-text-tertiary">
                  {frameLabel(index)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex gap-2 md:gap-3">
            {placed.map((column, c) => (
              <div
                key={c}
                className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3"
              >
                {column.map(({ item, index }) => tile(item, index, false))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
