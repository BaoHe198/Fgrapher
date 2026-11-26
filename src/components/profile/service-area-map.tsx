"use client";

import type { Map as MapInstance } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

const FALLBACK_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
maplibregl.setWorkerUrl("/vendor/maplibre-gl/maplibre-gl-worker.mjs");

/** With no travel radius given, the area drawn around a blurred point. */
const DEFAULT_AREA_KM = 2;

// A circle as a polygon, since a map circle layer is sized in pixels, not
// kilometres. 64 points is round enough at this size.
function circle(latitude: number, longitude: number, radiusKm: number) {
  const points: [number, number][] = [];
  const latRadius = radiusKm / 111.32;
  const lngRadius =
    radiusKm / (111.32 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  for (let i = 0; i <= 64; i += 1) {
    const angle = (i / 64) * Math.PI * 2;
    points.push([
      longitude + Math.cos(angle) * lngRadius,
      latitude + Math.sin(angle) * latRadius,
    ]);
  }
  return points;
}

/**
 * A small still map on a provider's public profile: the area they work in,
 * or where a studio is.
 *
 * `pin` puts a marker on the point and is only ever true for a studio that
 * chose to show its position (services/profile-area.ts). Without it the
 * point is a neighbourhood: the map draws an area around it and no marker,
 * so nothing on screen claims "they are exactly here".
 *
 * Not interactive: it would trap a phone's scroll.
 */
export function ServiceAreaMap({
  latitude,
  longitude,
  radiusKm,
  pin,
  label,
  className,
}: {
  latitude: number;
  longitude: number;
  radiusKm: number | null;
  pin: boolean;
  label: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style:
        process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || FALLBACK_STYLE_URL,
      center: [longitude, latitude],
      zoom: pin ? 15 : 11,
      interactive: false,
      attributionControl: false,
    });
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.once("load", () => {
      containerRef.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show");

      // A pinned studio shows its travel radius only if it has one; an
      // area always shows a circle, since that circle is all it has.
      const km = radiusKm ?? (pin ? null : DEFAULT_AREA_KM);
      if (!km) return;
      const ring = circle(latitude, longitude, km);
      map.addSource("service-area", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [ring] },
        },
      });
      map.addLayer({
        id: "service-area-fill",
        type: "fill",
        source: "service-area",
        paint: { "fill-color": "#5548b1", "fill-opacity": 0.14 },
      });
      map.addLayer({
        id: "service-area-line",
        type: "line",
        source: "service-area",
        paint: {
          "line-color": "#5548b1",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
      const lngs = ring.map(([lng]) => lng);
      const lats = ring.map(([, lat]) => lat);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 24, animate: false, maxZoom: 14 },
      );
    });
    if (pin) {
      new maplibregl.Marker({ color: "#342951" })
        .setLngLat([longitude, latitude])
        .addTo(map);
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, radiusKm, pin]);

  return (
    // MapLibre gives the element it mounts into `position: relative`, which
    // overrode `absolute inset-0` and collapsed the map to zero height — the
    // positioning lives on a wrapper, as in components/fmap/fmap-map.tsx.
    <div className={className ?? "absolute inset-0"}>
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
