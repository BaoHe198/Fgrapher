"use client";

import dynamic from "next/dynamic";

// The map library touches `window` as it loads, so it is only ever loaded in
// the browser; a server page renders this wrapper instead.
export const PlaceMiniMapLazy = dynamic(
  () =>
    import("@/components/places/place-mini-map").then((m) => m.PlaceMiniMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-44 rounded-[var(--fg-radius-md)] bg-bg-sunken sm:h-52" />
    ),
  },
);
