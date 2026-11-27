"use client";

import type { Map as MapInstance } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { applyBaseMapStyle } from "@/lib/map-style";

maplibregl.setWorkerUrl("/vendor/maplibre-gl/maplibre-gl-worker.mjs");

/**
 * A small still map with the spot's pin, on its page: where it is at a
 * glance. Not interactive (it would trap a phone's scroll); the buttons
 * beside it open directions or Fmap.
 */
export function PlaceMiniMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [longitude, latitude],
      zoom: 14,
      interactive: false,
      attributionControl: false,
    });
    applyBaseMapStyle(map);
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.once("load", () =>
      containerRef.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show"),
    );
    new maplibregl.Marker({ color: "#0b2d27" })
      .setLngLat([longitude, latitude])
      .addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  return (
    // MapLibre gives the element it mounts into `position: relative`, which
    // overrode `absolute inset-0` and collapsed the map to zero height (it
    // showed as an empty box) — the positioning lives on a wrapper, as in
    // components/fmap/fmap-map.tsx.
    <div className="relative h-44 overflow-hidden rounded-[var(--fg-radius-md)] border border-border-subtle bg-bg-sunken sm:h-52">
      <div className="absolute inset-0">
        <div
          ref={containerRef}
          role="img"
          aria-label={label}
          className="size-full"
        />
      </div>
    </div>
  );
}
