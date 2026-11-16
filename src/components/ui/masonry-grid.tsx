"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

// A photo grid that never crops (wave 2 kit §03): the photographer framed
// the shot, so every photo keeps its own ratio. Photos go, in the order the
// artist set, into whichever column is shortest - heights come from the
// stored width/height, so the page does not jump as images arrive. (A
// "contact sheet" square-cell mode and its switch were removed at the
// owner's request: the two looked too alike to be worth a choice.)

export interface MasonryItem {
  id: string;
  src: string;
  width?: number | null;
  height?: number | null;
  alt: string;
}

interface MasonryGridProps {
  items: MasonryItem[];
  onOpen?: (index: number) => void;
  /** Overlay drawn on each photo (name and price in Tìm kiếm F). */
  renderOverlay?: (item: MasonryItem, index: number) => React.ReactNode;
  sizes?: string;
  className?: string;
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
  renderOverlay,
  sizes = "(min-width: 900px) 25vw, (min-width: 480px) 33vw, 50vw",
  className,
}: MasonryGridProps) {
  const t = useTranslations("uiKit.masonry");
  const [columns, setColumns] = React.useState(3);
  const ref = React.useRef<HTMLDivElement>(null);

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

  // Shortest-column placement, keeping each photo's index for the lightbox
  // and its frame number.
  const placed = React.useMemo(() => {
    // A short roll gets fewer, larger columns (owner, 16/11/2026): six
    // photos across four columns left holes and showed each one small.
    const count = Math.min(
      columns,
      items.length <= 4 ? 2 : items.length <= 8 ? 3 : columns,
    );
    const cols: { item: MasonryItem; index: number }[][] = Array.from(
      { length: count },
      () => [],
    );
    const heights = new Array(count).fill(0);
    items.forEach((item, index) => {
      const ratio = item.width && item.height ? item.height / item.width : 1.25;
      const target = heights.indexOf(Math.min(...heights));
      cols[target].push({ item, index });
      heights[target] += ratio;
    });
    return cols;
  }, [items, columns]);

  const tile = (item: MasonryItem, index: number) => (
    <button
      key={item.id}
      type="button"
      data-interactive="true"
      // Lets a lightbox find the tile it should fly back to.
      data-frame-index={index}
      onClick={() => onOpen?.(index)}
      aria-label={t("open", { frame: index + 1 })}
      className="group/tile focus-ring relative block w-full overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken text-left"
    >
      <Image
        src={item.src}
        alt={item.alt}
        width={item.width ?? 800}
        height={item.height ?? 1000}
        sizes={sizes}
        className={cn(
          "h-auto w-full transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/tile:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover/tile:scale-100",
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
      ref={ref}
      className={cn("flex gap-2 md:gap-3", className)}
      data-slot="masonry-grid"
    >
      {placed.map((column, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3">
          {column.map(({ item, index }) => tile(item, index))}
        </div>
      ))}
    </div>
  );
}
