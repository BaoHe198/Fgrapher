import { cn } from "@/lib/utils";

// Bản đồ F marker (system audit 09/2026 §05/§06): a photo frame, not a
// price pill. Customers pick an artist by the work first and the price
// second, so the marker is a portfolio thumbnail with the starting price
// under it in mono ("2,0tr"). Selected: scales 1.12 with a gold ring in
// 200ms, no bounce. A cluster is a stack of frames with a count. A 4px
// ring instead of a drop shadow keeps it visible on a dark map.
//
// fmap-map.tsx builds the same markup imperatively for MapLibre (markers
// live outside React there) from MAP_MARKER_CLASSES, so both stay in step.

export const MAP_MARKER_CLASSES = {
  root: "group/marker flex flex-col items-center gap-1 transition-transform duration-[var(--fg-dur-200)] ease-fg-out",
  selected: "scale-[1.12]",
  frame:
    "relative size-11 overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken shadow-[0_0_0_2px_var(--bg-surface),0_0_0_4px_hsl(168_62%_7%/0.18)]",
  frameSelected:
    "shadow-[0_0_0_2px_var(--bg-surface),0_0_0_4px_var(--gold-400)]",
  frameSeen: "opacity-70",
  image: "size-full object-cover",
  initial:
    "flex size-full items-center justify-center text-body-sm font-semibold text-text-secondary",
  price:
    "rounded-[4px] bg-green-950 px-1.5 py-0.5 font-mono text-meta leading-none whitespace-nowrap text-gold-50 tabular-nums",
  priceSelected: "bg-gold-400 text-gold-900",
  count:
    "absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 font-mono text-meta leading-5 text-text-on-brand",
} as const;

/** 2000000 → "2,0tr", 750000 → "750k". Short enough for a map. */
export function compactVnd(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  if (amount >= 1_000_000)
    return `${(amount / 1_000_000).toFixed(1).replace(".", ",")}tr`;
  return `${Math.round(amount / 1000)}k`;
}

interface MapMarkerProps {
  label: string;
  photoUrl?: string | null;
  price?: number | null;
  /** Cluster size; > 1 draws the frame as a stack with a count. */
  count?: number;
  selected?: boolean;
  seen?: boolean;
  className?: string;
}

export function MapMarker({
  label,
  photoUrl,
  price,
  count = 1,
  selected = false,
  seen = false,
  className,
}: MapMarkerProps) {
  const priceLabel = compactVnd(price);
  return (
    <span
      data-slot="map-marker"
      className={cn(
        MAP_MARKER_CLASSES.root,
        selected && MAP_MARKER_CLASSES.selected,
        className,
      )}
    >
      <span className="relative">
        <span
          className={cn(
            MAP_MARKER_CLASSES.frame,
            "block",
            selected && MAP_MARKER_CLASSES.frameSelected,
            seen && !selected && MAP_MARKER_CLASSES.frameSeen,
          )}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a 44px map thumbnail; next/image's wrapper breaks MapLibre's marker sizing.
            <img src={photoUrl} alt="" className={MAP_MARKER_CLASSES.image} />
          ) : (
            <span className={MAP_MARKER_CLASSES.initial}>
              {label.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        {count > 1 ? (
          <span className={MAP_MARKER_CLASSES.count}>{count}</span>
        ) : null}
      </span>
      {priceLabel ? (
        <span
          className={cn(
            MAP_MARKER_CLASSES.price,
            selected && MAP_MARKER_CLASSES.priceSelected,
          )}
        >
          {priceLabel}
        </span>
      ) : null}
    </span>
  );
}
