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

import { compactVnd, MAP_MARKER_CLASSES } from "@/components/fmap/map-marker";
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
const MAX_ZOOM = 18;
const CLUSTER_LIST_LIMIT = 50;

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
  // MapLibre positions the element it is given with an inline transform, so
  // that element must never move itself: a hover lift on it pushed the box
  // out from under the pointer, un-hovered, dropped back, and looped -
  // visible as jitter. The wrapper keeps a fixed hit area and owns :hover
  // and the selected state; only the inner button moves.
  //
  // The marker itself is the photo-frame design shared with the React
  // MapMarker (map-marker.tsx, MAP_MARKER_CLASSES): a portfolio thumbnail
  // with the starting price in mono under it. Selected scales 1.12 with a
  // gold ring in 200ms, no bounce.
  const wrapper = document.createElement("div");
  wrapper.className = "group";
  if (selected) wrapper.dataset.selected = "true";

  const button = document.createElement("button");
  button.type = "button";
  button.className = [
    MAP_MARKER_CLASSES.root,
    "cursor-pointer rounded-[var(--fg-radius-sm)] outline-none group-hover:-translate-y-0.5 group-data-[selected=true]:scale-[1.12] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus motion-reduce:group-hover:translate-y-0",
  ].join(" ");
  button.setAttribute(
    "aria-label",
    `${marker.displayName}, ${priceLabel(marker.startingPrice, marker.currency, labels)}`,
  );
  button.addEventListener("click", () => onSelect(marker.profileId));

  const frame = document.createElement("span");
  frame.className = [
    MAP_MARKER_CLASSES.frame,
    "block transition-shadow duration-[var(--fg-dur-200)] group-data-[selected=true]:shadow-[0_0_0_2px_var(--bg-surface),0_0_0_4px_var(--gold-400)]",
  ].join(" ");
  const photo = marker.thumbnailUrl ?? marker.avatar;
  if (photo) {
    const image = document.createElement("img");
    image.src = photo;
    image.alt = "";
    image.loading = "lazy";
    image.className = MAP_MARKER_CLASSES.image;
    frame.appendChild(image);
  } else {
    const fallback = document.createElement("span");
    fallback.className = MAP_MARKER_CLASSES.initial;
    fallback.textContent = marker.displayName.slice(0, 1).toUpperCase();
    frame.appendChild(fallback);
  }

  const price = document.createElement("span");
  price.className = [
    MAP_MARKER_CLASSES.price,
    "transition-colors duration-[var(--fg-dur-200)] group-data-[selected=true]:bg-gold-400 group-data-[selected=true]:text-gold-900",
  ].join(" ");
  price.textContent =
    compactVnd(marker.currency === "VND" ? marker.startingPrice : null) ??
    labels.contact;

  button.append(frame, price);
  wrapper.appendChild(button);
  return wrapper;
}

export function FmapMap({
  markers,
  selectedProfileId,
  centreRequest,
  fitRequest,
  onBoundsChange,
  onSelectProvider,
  onSelectCluster,
  labels,
}: {
  markers: FmapMarker[];
  selectedProfileId: string | null;
  centreRequest: { latitude: number; longitude: number; nonce: number } | null;
  /** keepZoom: centre the bounds without zooming in past the current
   * level — used to pull results off the edge, not to re-frame the map. */
  fitRequest: { bounds: FmapBounds; nonce: number; keepZoom?: boolean } | null;
  onBoundsChange: (bounds: FmapBounds) => void;
  onSelectProvider: (profileId: string) => void;
  /** Providers that share one spot and can't be split by zooming. */
  onSelectCluster: (profileIds: string[]) => void;
  labels: MarkerLabels;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const domMarkersRef = useRef(new Map<string, maplibregl.Marker>());
  const dataRef = useRef(markers);
  const boundsCallbackRef = useRef(onBoundsChange);
  const selectCallbackRef = useRef(onSelectProvider);
  const clusterCallbackRef = useRef(onSelectCluster);
  const labelsRef = useRef(labels);
  const selectedRef = useRef(selectedProfileId);

  useEffect(() => {
    dataRef.current = markers;
    boundsCallbackRef.current = onBoundsChange;
    selectCallbackRef.current = onSelectProvider;
    clusterCallbackRef.current = onSelectCluster;
    labelsRef.current = labels;
    selectedRef.current = selectedProfileId;
  }, [
    markers,
    onBoundsChange,
    onSelectProvider,
    onSelectCluster,
    labels,
    selectedProfileId,
  ]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const configuredStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: configuredStyle || FALLBACK_STYLE_URL,
      center: [106.7009, 10.7769],
      zoom: 11,
      minZoom: 5,
      maxZoom: MAX_ZOOM,
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
        // Cluster up to one step below maxZoom: providers still sharing a
        // cluster there are at (almost) the same spot and get a list
        // instead of overlapping, unclickable markers.
        clusterMaxZoom: MAX_ZOOM - 1,
        clusterRadius: 64,
      });
      map.addLayer({
        id: CLUSTERS_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          // green-900 / gold-400 from globals.css (GL layers can't read CSS
          // variables). The ring doubles as the dark-map outline a drop
          // shadow can't give (audit §04).
          "circle-color": "#0b2d27",
          "circle-radius": ["step", ["get", "point_count"], 20, 20, 25, 60, 32],
          "circle-stroke-width": 4,
          "circle-stroke-color": "#c8a36a",
        },
      });
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          // Both OpenFreeMap and MapTiler serve Noto Sans; MapLibre's
          // default (Open Sans / Arial Unicode) 404s on OpenFreeMap.
          "text-font": ["Noto Sans Bold"],
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
      if (zoom > MAX_ZOOM - 1) {
        const leaves = await source.getClusterLeaves(
          clusterId,
          CLUSTER_LIST_LIMIT,
          0,
        );
        clusterCallbackRef.current(
          leaves
            .map((leaf) => leaf.properties?.profileId as string | undefined)
            .filter((id): id is string => Boolean(id)),
        );
        return;
      }
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
    // "render" fires every animation frame while panning; querying rendered
    // features that often is wasted work, so sync at most every 120 ms.
    // moveend above still does a final exact sync.
    let lastSync = 0;
    map.on("render", () => {
      const now = performance.now();
      if (now - lastSync < 120) return;
      lastSync = now;
      refreshDomMarkers();
    });
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
      {
        padding: 64,
        maxZoom: fitRequest.keepZoom
          ? Math.min(13, mapRef.current.getZoom())
          : 13,
        duration: 900,
      },
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
