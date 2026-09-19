"use client";

import type {
  GeoJSONSource,
  LngLatBounds,
  Map as MapInstance,
  MapMouseEvent,
} from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import type { FmapMarker } from "@/services/fmap";

export type FmapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const SOURCE_ID = "fmap-providers";
const CLUSTERS_LAYER = "fmap-clusters";
const CLUSTER_COUNT_LAYER = "fmap-cluster-count";
const UNCLUSTERED_LAYER = "fmap-unclustered";

const roleIconPaths: Record<FmapMarker["role"], string[]> = {
  PHOTOGRAPHER: [
    "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",
    "M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  ],
  VIDEOGRAPHER: [
    "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",
    "M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
  ],
  MAKEUP_ARTIST: [
    "m11 10 3 3",
    "M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z",
    "M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031",
  ],
  STUDIO: [
    "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
    "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",
    "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",
    "M10 6h4",
    "M10 10h4",
    "M10 14h4",
    "M10 18h4",
  ],
  MODEL: [
    "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",
    "M12 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
  ],
};

function roleIcon(role: FmapMarker["role"]) {
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  for (const [name, value] of Object.entries({
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }))
    svg.setAttribute(name, value);
  for (const d of roleIconPaths[role]) {
    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

// Keyless fallback when NEXT_PUBLIC_MAP_STYLE_URL is unset. OpenFreeMap
// serves vector tiles with no API key or request quota, unlike the public
// tile.openstreetmap.org servers — whose usage policy forbids app traffic and
// whose hostname some Vietnamese ISP resolvers return NXDOMAIN for, which
// left the map blank during local testing.
const FALLBACK_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Served from public/ by scripts/copy-maplibre-worker.mjs — MapLibre's own
// import.meta.url-based lookup breaks under Turbopack (see that script).
maplibregl.setWorkerUrl("/vendor/maplibre-gl/maplibre-gl-worker.mjs");

function toBounds(bounds: LngLatBounds): FmapBounds {
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  };
}

export interface MarkerLabels {
  from: (price: string) => string;
  contact: string;
}

function priceLabel(
  value: number | null,
  currency: string,
  labels: MarkerLabels,
) {
  if (value == null) return labels.contact;
  if (currency === "VND" && value >= 1_000_000) {
    return labels.from(
      `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000)}tr`,
    );
  }
  if (currency === "VND" && value < 1_000_000) {
    return labels.from(
      `${new Intl.NumberFormat("vi-VN").format(Math.round(value / 1000))}k`,
    );
  }
  return labels.from(
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value),
  );
}

function markerElement(
  marker: FmapMarker,
  onSelect: (profileId: string) => void,
  labels: MarkerLabels,
  selected: boolean,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "group relative flex cursor-pointer flex-col items-center rounded-full outline-none transition-transform duration-200 hover:-translate-y-1 focus-visible:ring-3 focus-visible:ring-gold-400";
  if (selected) button.dataset.selected = "true";
  button.setAttribute(
    "aria-label",
    `${marker.displayName}, ${priceLabel(marker.startingPrice, marker.currency, labels)}`,
  );
  button.addEventListener("click", () => onSelect(marker.profileId));

  const frame = document.createElement("span");
  frame.className =
    "relative block size-14 overflow-hidden rounded-full border-3 border-white bg-green-800 shadow-[var(--shadow-lg)] group-hover:shadow-[0_8px_24px_rgba(0,0,0,.28)] transition-transform group-data-[selected=true]:scale-110 group-data-[selected=true]:border-gold-400";
  if (marker.avatar) {
    const image = document.createElement("img");
    image.src = marker.avatar;
    image.alt = "";
    image.loading = "lazy";
    image.className = "size-full object-cover";
    frame.appendChild(image);
  } else {
    const fallback = document.createElement("span");
    fallback.className =
      "flex size-full items-center justify-center text-xl text-white";
    fallback.textContent = marker.displayName.slice(0, 1).toUpperCase();
    frame.appendChild(fallback);
  }

  const roleBadge = document.createElement("span");
  roleBadge.className =
    "relative z-10 -mb-2 flex size-7 items-center justify-center rounded-full border-2 border-white bg-gold-400 text-neutral-900 shadow-sm";
  roleBadge.appendChild(roleIcon(marker.role));

  const price = document.createElement("span");
  price.className =
    "mt-1 rounded-full border border-border-default bg-bg-surface px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-text-primary shadow-md";
  price.textContent = priceLabel(marker.startingPrice, marker.currency, labels);

  button.append(roleBadge, frame, price);
  return button;
}

export function FmapMap({
  markers,
  selectedProfileId,
  centreRequest,
  fitRequest,
  onBoundsChange,
  onSelectProvider,
  labels,
}: {
  markers: FmapMarker[];
  selectedProfileId: string | null;
  centreRequest: { latitude: number; longitude: number; nonce: number } | null;
  fitRequest: { bounds: FmapBounds; nonce: number } | null;
  onBoundsChange: (bounds: FmapBounds) => void;
  onSelectProvider: (profileId: string) => void;
  labels: MarkerLabels;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const domMarkersRef = useRef(new Map<string, maplibregl.Marker>());
  const dataRef = useRef(markers);
  const boundsCallbackRef = useRef(onBoundsChange);
  const selectCallbackRef = useRef(onSelectProvider);
  const labelsRef = useRef(labels);
  const selectedRef = useRef(selectedProfileId);

  useEffect(() => {
    dataRef.current = markers;
    boundsCallbackRef.current = onBoundsChange;
    selectCallbackRef.current = onSelectProvider;
    labelsRef.current = labels;
    selectedRef.current = selectedProfileId;
  }, [markers, onBoundsChange, onSelectProvider, labels, selectedProfileId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const configuredStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: configuredStyle || FALLBACK_STYLE_URL,
      center: [106.7009, 10.7769],
      zoom: 11,
      minZoom: 5,
      maxZoom: 18,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );

    const refreshDomMarkers = () => {
      if (!map.getLayer(UNCLUSTERED_LAYER)) return;
      const visibleIds = new Set<string>();
      for (const feature of map.queryRenderedFeatures({
        layers: [UNCLUSTERED_LAYER],
      })) {
        const profileId = feature.properties?.profileId as string | undefined;
        if (!profileId || visibleIds.has(profileId)) continue;
        visibleIds.add(profileId);
        if (domMarkersRef.current.has(profileId)) continue;
        const marker = dataRef.current.find(
          (item) => item.profileId === profileId,
        );
        if (!marker) continue;
        const domMarker = new maplibregl.Marker({
          element: markerElement(
            marker,
            (id) => selectCallbackRef.current(id),
            labelsRef.current,
            selectedRef.current === profileId,
          ),
          anchor: "bottom",
        })
          .setLngLat([marker.longitude, marker.latitude])
          .addTo(map);
        domMarkersRef.current.set(profileId, domMarker);
      }
      for (const [profileId, marker] of domMarkersRef.current) {
        if (!visibleIds.has(profileId)) {
          marker.remove();
          domMarkersRef.current.delete(profileId);
        }
      }
    };

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: dataRef.current.map((marker) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [marker.longitude, marker.latitude],
            },
            properties: { profileId: marker.profileId },
          })),
        },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 64,
      });
      map.addLayer({
        id: CLUSTERS_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#0f4c3a",
          "circle-radius": ["step", ["get", "point_count"], 20, 20, 25, 60, 32],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#f5c76b",
        },
      });
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 13,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: UNCLUSTERED_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 24, "circle-opacity": 0 },
      });
      boundsCallbackRef.current(toBounds(map.getBounds()));
    });

    map.on("click", CLUSTERS_LAYER, async (event: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, {
        layers: [CLUSTERS_LAYER],
      })[0];
      const clusterId = feature?.properties?.cluster_id as number | undefined;
      if (clusterId == null) return;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      if (feature.geometry.type === "Point") {
        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom,
        });
      }
    });
    map.on("mouseenter", CLUSTERS_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", CLUSTERS_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("moveend", () => {
      boundsCallbackRef.current(toBounds(map.getBounds()));
      refreshDomMarkers();
    });
    map.on("render", refreshDomMarkers);
    const domMarkers = domMarkersRef.current;

    return () => {
      for (const marker of domMarkers.values()) marker.remove();
      domMarkers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource(SOURCE_ID)) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource;
    source.setData({
      type: "FeatureCollection",
      features: markers.map((marker) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [marker.longitude, marker.latitude],
        },
        properties: { profileId: marker.profileId },
      })),
    });
    for (const marker of domMarkersRef.current.values()) marker.remove();
    domMarkersRef.current.clear();
    map.triggerRepaint();
  }, [markers]);

  useEffect(() => {
    if (!centreRequest || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [centreRequest.longitude, centreRequest.latitude],
      zoom: 13,
      duration: 900,
    });
  }, [centreRequest]);

  useEffect(() => {
    if (!fitRequest || !mapRef.current) return;
    const { north, south, east, west } = fitRequest.bounds;
    mapRef.current.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 48, maxZoom: 13, duration: 900 },
    );
  }, [fitRequest]);

  useEffect(() => {
    if (!selectedProfileId) return;
    const marker = markers.find((item) => item.profileId === selectedProfileId);
    if (marker)
      mapRef.current?.easeTo({
        center: [marker.longitude, marker.latitude],
        duration: 500,
      });
  }, [markers, selectedProfileId]);

  useEffect(() => {
    for (const [profileId, marker] of domMarkersRef.current) {
      const element = marker.getElement();
      if (profileId === selectedProfileId) element.dataset.selected = "true";
      else delete element.dataset.selected;
    }
  }, [selectedProfileId]);

  return (
    // MapLibre adds `.maplibregl-map { position: relative }` to the element
    // it mounts into, which would override `absolute inset-0` and collapse
    // the map to zero height — so the positioning lives on a wrapper.
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" aria-label="Fmap" />
    </div>
  );
}
