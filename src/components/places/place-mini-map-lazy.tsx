"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import { useNearViewport } from "@/hooks/use-near-viewport";

const PLACEHOLDER_CLASS =
  "h-44 rounded-[var(--fg-radius-md)] bg-bg-sunken sm:h-52";

// The map library touches `window` as it loads, so it is only ever loaded in
// the browser; a server page renders this wrapper instead.
const PlaceMiniMap = dynamic(
  () =>
    import("@/components/places/place-mini-map").then((m) => m.PlaceMiniMap),
  {
    ssr: false,
    loading: () => <div className={PLACEHOLDER_CLASS} />,
  },
);

/**
 * A photo spot's small map, started only when the visitor has scrolled to
 * within a screen of it. Until then a box of the same size holds its place,
 * so nothing moves when the map arrives.
 */
export function PlaceMiniMapLazy(props: ComponentProps<typeof PlaceMiniMap>) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  if (near) return <PlaceMiniMap {...props} />;
  return <div ref={ref} className={PLACEHOLDER_CLASS} />;
}
