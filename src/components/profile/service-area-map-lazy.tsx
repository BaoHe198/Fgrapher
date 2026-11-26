"use client";

import dynamic from "next/dynamic";

// The map library touches `window` as it loads, so it is only ever loaded in
// the browser, and only on a profile that has a point to show.
export const ServiceAreaMapLazy = dynamic(
  () =>
    import("@/components/profile/service-area-map").then(
      (m) => m.ServiceAreaMap,
    ),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-bg-sunken" />,
  },
);
