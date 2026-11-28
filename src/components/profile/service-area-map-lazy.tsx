"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import { useNearViewport } from "@/hooks/use-near-viewport";

// The map library touches `window` as it loads, so it is only ever loaded in
// the browser, and only on a profile that has a point to show.
const ServiceAreaMap = dynamic(
  () =>
    import("@/components/profile/service-area-map").then(
      (m) => m.ServiceAreaMap,
    ),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-bg-sunken" />,
  },
);

/**
 * The profile's small map, started only when the visitor has scrolled to
 * within a screen of it. It sits well below the first screen, and loading it
 * with the page made every profile view pay for the map engine.
 */
export function ServiceAreaMapLazy(
  props: ComponentProps<typeof ServiceAreaMap>,
) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  return (
    <div ref={ref} className="absolute inset-0 bg-bg-sunken">
      {near ? <ServiceAreaMap {...props} /> : null}
    </div>
  );
}
