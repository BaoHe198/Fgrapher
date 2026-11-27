"use client";

import type { Map as MapInstance, Marker } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { applyBaseMapStyle } from "@/lib/map-style";

// Same keyless style and worker as Fmap (components/fmap/fmap-map.tsx).
maplibregl.setWorkerUrl("/vendor/maplibre-gl/maplibre-gl-worker.mjs");

export interface PinPoint {
  latitude: number;
  longitude: number;
}

/**
 * The map in the "propose a spot" form: tap to drop the pin, drag it to
 * adjust. Loaded with next/dynamic (no SSR) by place-pin-picker.tsx.
 */
export function PlacePinMap({
  value,
  onChange,
  centreRequest,
  label,
  gestureHelp,
}: {
  /** "Use two fingers…" — the map is inside a long form on a phone. */
  gestureHelp: { mobile: string; windows: string; mac: string };
  value: PinPoint | null;
  onChange: (point: PinPoint) => void;
  /** Fly here (e.g. the visitor's own location). */
  centreRequest: (PinPoint & { nonce: number }) | null;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialRef = useRef(value);
  // Read once when the map is made; the words do not change after.
  const gestureRef = useRef(gestureHelp);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start = initialRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: start ? [start.longitude, start.latitude] : [106.7009, 10.7769],
      zoom: start ? 15 : 11,
      minZoom: 4,
      maxZoom: 19,
      attributionControl: false,
      // One finger scrolls the form, two move the map (and Ctrl/⌘ + wheel
      // zooms on a computer). Without this a phone user swiping down the
      // form over the map moved the map instead and got stuck.
      cooperativeGestures: true,
      locale: {
        "CooperativeGesturesHandler.MobileHelpText": gestureRef.current.mobile,
        "CooperativeGesturesHandler.WindowsHelpText":
          gestureRef.current.windows,
        "CooperativeGesturesHandler.MacHelpText": gestureRef.current.mac,
      },
    });
    applyBaseMapStyle(map);
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "top-right",
    );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    mapRef.current = map;
    // Folded to its (i) button, as on Fmap: opened, the credit line
    // covered the top of this small map.
    map.once("load", () =>
      containerRef.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show"),
    );

    const place = (lngLat: maplibregl.LngLat) => {
      if (!markerRef.current) {
        const marker = new maplibregl.Marker({
          draggable: true,
          color: "#0b2d27",
        })
          .setLngLat(lngLat)
          .addTo(map);
        marker.on("dragend", () => {
          const at = marker.getLngLat();
          onChangeRef.current({ latitude: at.lat, longitude: at.lng });
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLngLat(lngLat);
      }
    };
    if (start) place(new maplibregl.LngLat(start.longitude, start.latitude));
    map.on("click", (event) => {
      place(event.lngLat);
      onChangeRef.current({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // A pin set from outside (the location button) moves the marker too.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    const at = new maplibregl.LngLat(value.longitude, value.latitude);
    if (!markerRef.current) {
      const marker = new maplibregl.Marker({
        draggable: true,
        color: "#0b2d27",
      })
        .setLngLat(at)
        .addTo(map);
      marker.on("dragend", () => {
        const next = marker.getLngLat();
        onChangeRef.current({ latitude: next.lat, longitude: next.lng });
      });
      markerRef.current = marker;
    } else {
      const current = markerRef.current.getLngLat();
      if (current.lat !== at.lat || current.lng !== at.lng) {
        markerRef.current.setLngLat(at);
      }
    }
  }, [value]);

  useEffect(() => {
    if (!centreRequest || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [centreRequest.longitude, centreRequest.latitude],
      zoom: 16,
      duration: 800,
    });
  }, [centreRequest]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" aria-label={label} />
    </div>
  );
}
