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
import { applyBaseMapStyle } from "@/lib/map-style";
import {
  MAP_MARKER_DELIVERY_SIZE,
  buildSquareThumbUrl,
} from "@/lib/media/variants";
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
// The "Địa điểm chụp" layer (services/places.ts): gold dots with a name at
// street zoom, drawn under the providers' photo-frame markers.
const PLACES_SOURCE = "fmap-places";
const PLACES_LABEL_LAYER = "fmap-places-label";
// Invisible: only there to ask the map which spots and spot clusters are
// on screen, so each gets a DOM marker (above the providers' photos).
const PLACES_HIT_LAYER = "fmap-places-hit";

export interface FmapPlacePin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// A spot is a DOM marker, not a map-layer circle: drawn on the canvas it
// sat under the providers' photo markers and could not be tapped at city
// zoom (found in the 21/11/2026 walk-through). As a button it is also
// reachable by keyboard and named for screen readers.
function placeMarkerElement(
  place: FmapPlacePin,
  onSelect: (placeId: string) => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", place.name);
  button.className =
    "group block size-11 cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
  const dot = document.createElement("span");
  dot.className =
    "m-auto block size-5 rounded-full border-[3px] border-white bg-[#c8a36a] shadow-[0_1px_4px_rgb(0_0_0/0.35)] transition-transform duration-[var(--fg-dur-200)] group-hover:scale-110 group-data-[selected=true]:scale-125 group-data-[selected=true]:border-[#0b2d27]";
  button.appendChild(dot);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect(place.id);
  });
  return button;
}

// Spots closer than a marker's width at the current zoom become one gold
// bubble with a count: two dots 100 m apart at city zoom sat on top of each
// other and the lower one could not be tapped (21/11 walk-through).
function placeClusterElement(
  count: number,
  label: string,
  onSelect: () => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.className =
    "group grid size-11 cursor-pointer place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
  const bubble = document.createElement("span");
  bubble.className =
    "grid size-8 place-items-center rounded-full border-[3px] border-white bg-[#c8a36a] text-[13px] font-bold text-white shadow-[0_1px_4px_rgb(0_0_0/0.35)] transition-transform duration-[var(--fg-dur-200)] group-hover:scale-110";
  bubble.textContent = String(count);
  button.appendChild(bubble);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onSelect();
  });
  return button;
}

function placeFeatures(places: FmapPlacePin[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.map((place) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [place.longitude, place.latitude],
      },
      properties: { placeId: place.id, name: place.name },
    })),
  };
}
const CLUSTER_LIST_LIMIT = 50;

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
    // The frame is 44px: never the photo as uploaded (see variants.ts).
    image.src = buildSquareThumbUrl(photo, MAP_MARKER_DELIVERY_SIZE);
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
    "transition-colors duration-[var(--fg-dur-200)] group-data-[selected=true]:bg-gold-400 group-data-[selected=true]:text-white",
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
  zoomRequest,
  bottomInset = 0,
  places = [],
  selectedPlaceId = null,
  onSelectPlace,
  placeClusterLabel = (count) => String(count),
}: {
  /** Accessible name of a bubble of `count` spots. */
  placeClusterLabel?: (count: number) => string;
  /** Photo spots to draw; empty when the layer is off. */
  places?: FmapPlacePin[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (placeId: string) => void;
  markers: FmapMarker[];
  selectedProfileId: string | null;
  centreRequest: { latitude: number; longitude: number; nonce: number } | null;
  /** keepZoom: centre the bounds without zooming in past the current
   * level — used to pull results off the edge, not to re-frame the map. */
  fitRequest: { bounds: FmapBounds; nonce: number; keepZoom?: boolean } | null;
  /** byUser: the customer moved the map themselves. */
  onBoundsChange: (bounds: FmapBounds, byUser: boolean) => void;
  onSelectProvider: (profileId: string) => void;
  /** Providers that share one spot and can't be split by zooming. */
  onSelectCluster: (profileIds: string[]) => void;
  labels: MarkerLabels;
  /** One step in (+1) or out (-1), from the page's own 44px controls. */
  zoomRequest?: { delta: number; nonce: number } | null;
  /** Height covered by the results sheet on phones, kept out of centring. */
  bottomInset?: number;
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
  const placesRef = useRef(places);
  const selectPlaceRef = useRef(onSelectPlace);
  const selectedPlaceRef = useRef(selectedPlaceId);
  const placeMarkersRef = useRef(new Map<string, maplibregl.Marker>());
  const refreshPlaceMarkersRef = useRef<() => void>(() => {});
  const placeClusterLabelRef = useRef(placeClusterLabel);
  useEffect(() => {
    placeClusterLabelRef.current = placeClusterLabel;
  }, [placeClusterLabel]);
  const bottomInsetRef = useRef(bottomInset);
  useEffect(() => {
    bottomInsetRef.current = bottomInset;
  }, [bottomInset]);
  useEffect(() => {
    placesRef.current = places;
    selectPlaceRef.current = onSelectPlace;
    selectedPlaceRef.current = selectedPlaceId;
  }, [places, onSelectPlace, selectedPlaceId]);

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
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [106.7009, 10.7769],
      zoom: 11,
      minZoom: 5,
      maxZoom: MAX_ZOOM,
      attributionControl: false,
    });
    // The base style is set here, not in the constructor: see
    // lib/map-style.ts for which style and what is trimmed from it.
    applyBaseMapStyle(map);
    mapRef.current = map;
    // Zoom buttons are the page's own (44px, stacked above the results
    // sheet); MapLibre's 29px ones are too small to tap. Attribution sits
    // top-right, where the sheet never covers it.
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "top-right",
    );
    // Compact attribution opens expanded and only folds on the first drag;
    // folded from the start, it is one (i) button, not a strip over the map.
    map.once("load", () =>
      containerRef.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show"),
    );

    const refreshPlaceMarkers = () => {
      if (!map.getLayer(PLACES_HIT_LAYER)) return;
      const markers = placeMarkersRef.current;
      const seen = new Set<string>();
      for (const feature of map.queryRenderedFeatures({
        layers: [PLACES_HIT_LAYER],
      })) {
        const props = feature.properties ?? {};
        const isCluster = props.point_count != null;
        const key = isCluster ? `c:${props.cluster_id}` : String(props.placeId);
        if (seen.has(key)) continue;
        seen.add(key);
        if (markers.has(key)) continue;
        let element: HTMLElement;
        let at: [number, number];
        if (isCluster) {
          if (feature.geometry.type !== "Point") continue;
          at = feature.geometry.coordinates as [number, number];
          const clusterId = props.cluster_id as number;
          element = placeClusterElement(
            props.point_count as number,
            placeClusterLabelRef.current(props.point_count as number),
            async () => {
              const source = map.getSource(PLACES_SOURCE) as GeoJSONSource;
              const zoom = await source.getClusterExpansionZoom(clusterId);
              map.easeTo({ center: at, zoom }, { fgUser: true });
            },
          );
        } else {
          const place = placesRef.current.find((p) => p.id === props.placeId);
          if (!place) continue;
          at = [place.longitude, place.latitude];
          element = placeMarkerElement(place, (id) =>
            selectPlaceRef.current?.(id),
          );
          if (place.id === selectedPlaceRef.current) {
            element.dataset.selected = "true";
          }
        }
        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat(at)
          .addTo(map);
        marker.getElement().style.zIndex = "5";
        markers.set(key, marker);
      }
      for (const [key, marker] of markers) {
        if (!seen.has(key)) {
          marker.remove();
          markers.delete(key);
        }
      }
    };
    refreshPlaceMarkersRef.current = refreshPlaceMarkers;
    // Draw spot markers as soon as their data is in, not once every map
    // tile has loaded ("idle" could take seconds on a phone).
    map.on("sourcedata", (event) => {
      if (event.sourceId === PLACES_SOURCE && event.isSourceLoaded) {
        refreshPlaceMarkers();
      }
    });

    const refreshDomMarkers = () => {
      refreshPlaceMarkers();
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
      map.addSource(PLACES_SOURCE, {
        type: "geojson",
        data: placeFeatures(placesRef.current),
        cluster: true,
        clusterMaxZoom: MAX_ZOOM - 1,
        clusterRadius: 40,
      });
      map.addLayer({
        id: PLACES_HIT_LAYER,
        type: "circle",
        source: PLACES_SOURCE,
        paint: { "circle-radius": 1, "circle-opacity": 0 },
      });
      map.addLayer({
        id: PLACES_LABEL_LAYER,
        type: "symbol",
        source: PLACES_SOURCE,
        filter: ["!", ["has", "point_count"]],
        minzoom: 12,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-offset": [0, 1.3],
          "text-anchor": "top",
          "text-max-width": 10,
        },
        paint: {
          "text-color": "#0b2d27",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
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
          //
          // The regular face, which the base map has already fetched, with
          // a hairline halo in the text's own colour to give the digits
          // their weight. The bold face was a 45 KB download for one or two
          // digits on a bubble.
          "text-font": ["Noto Sans Regular"],
          "text-size": 13,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#ffffff",
          "text-halo-width": 0.5,
        },
      });
      map.addLayer({
        id: UNCLUSTERED_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 24, "circle-opacity": 0 },
      });
      boundsCallbackRef.current(toBounds(map.getBounds()), false);
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
        map.easeTo(
          {
            center: feature.geometry.coordinates as [number, number],
            zoom,
          },
          { fgUser: true },
        );
      }
    });
    map.on("mouseenter", CLUSTERS_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", CLUSTERS_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });
    // A move is the customer's when it came from a gesture (originalEvent)
    // or from one of our own zoom/cluster controls (fgUser); centring on a
    // chosen provider, fitting results or resizing the sheet is not.
    map.on(
      "moveend",
      (event: { originalEvent?: unknown; fgUser?: boolean }) => {
        boundsCallbackRef.current(
          toBounds(map.getBounds()),
          event.originalEvent != null || event.fgUser === true,
        );
        refreshDomMarkers();
      },
    );
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

  // Spots: names on the map layer, the dots as markers above everything.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(PLACES_SOURCE) as GeoJSONSource | undefined;
    if (!source) return;
    // New data, new clusters: rebuild the markers once the map has drawn it.
    for (const marker of placeMarkersRef.current.values()) marker.remove();
    placeMarkersRef.current.clear();
    void source.setData(placeFeatures(places));
    map.once("idle", () => refreshPlaceMarkersRef.current());
    map.triggerRepaint();
  }, [places]);

  useEffect(() => {
    for (const [id, marker] of placeMarkersRef.current) {
      const element = marker.getElement();
      if (id === selectedPlaceId) element.dataset.selected = "true";
      else delete element.dataset.selected;
    }
    // Centre the chosen spot in the part of the map the phone's sheet
    // leaves visible; it used to sit under the card that describes it.
    const place = places.find((item) => item.id === selectedPlaceId);
    if (place) {
      mapRef.current?.easeTo({
        center: [place.longitude, place.latitude],
        offset: [0, -bottomInsetRef.current / 2],
        duration: 500,
      });
    }
    // Only when the choice changes, not on every reload of the spots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaceId, places.length > 0]);

  useEffect(() => {
    const markers = placeMarkersRef.current;
    return () => {
      for (const marker of markers.values()) marker.remove();
      markers.clear();
    };
  }, []);

  useEffect(() => {
    if (!zoomRequest || !mapRef.current) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const map = mapRef.current;
    const options = { duration: reduced ? 0 : 250 };
    if (zoomRequest.delta > 0) map.zoomIn(options, { fgUser: true });
    else map.zoomOut(options, { fgUser: true });
  }, [zoomRequest]);

  useEffect(() => {
    if (!centreRequest || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [centreRequest.longitude, centreRequest.latitude],
      zoom: 13,
      // Above the phone's results sheet, not under it.
      offset: [0, -bottomInsetRef.current / 2],
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
        padding: {
          top: 64,
          right: 64,
          left: 64,
          bottom: 64 + bottomInsetRef.current,
        },
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
      // Centred in the part of the map the results sheet leaves visible.
      mapRef.current?.easeTo({
        center: [marker.longitude, marker.latitude],
        offset: [0, -bottomInsetRef.current / 2],
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
