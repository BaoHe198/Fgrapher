"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FmapFilterBar,
  type FmapFilterValue,
} from "@/components/fmap/fmap-filter-bar";
import type { FmapBounds, MarkerLabels } from "@/components/fmap/fmap-map";
import { FmapProviderPreviewCard } from "@/components/fmap/fmap-provider-preview";
import { Button } from "@/components/ui/button";
import { formatDate, vietnamDateKey } from "@/lib/format";
import type { FmapMarker, FmapProviderPreview } from "@/services/fmap";

const FmapMap = dynamic(
  () => import("@/components/fmap/fmap-map").then((module) => module.FmapMap),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 animate-pulse bg-bg-sunken" />
    ),
  },
);

// Two days out: past the 24-hour minimum booking notice, so the first
// search can actually return providers.
function defaultDate() {
  return vietnamDateKey(2);
}

type SearchResponse = {
  data: FmapMarker[] | null;
  truncated?: boolean;
  error: string | null;
  message: string | null;
};

export function FmapClient() {
  const t = useTranslations("fmap");
  const [filters, setFilters] = useState<FmapFilterValue>({
    date: defaultDate(),
    start: "09:00",
    end: "11:00",
    role: "PHOTOGRAPHER",
    category: "",
  });
  const [bounds, setBounds] = useState<FmapBounds | null>(null);
  const [markers, setMarkers] = useState<FmapMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [centreRequest, setCentreRequest] = useState<{
    latitude: number;
    longitude: number;
    nonce: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [preview, setPreview] = useState<FmapProviderPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [provinceId, setProvinceId] = useState("");
  const [provinceNotice, setProvinceNotice] = useState<string | null>(null);
  const [fitRequest, setFitRequest] = useState<{
    bounds: FmapBounds;
    nonce: number;
  } | null>(null);
  const [searchedFor, setSearchedFor] = useState<{
    date: string;
    start: string;
    end: string;
  } | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const initialSearchRef = useRef(false);
  const searchAfterFitRef = useRef(false);
  const ignoreNextMoveRef = useRef(false);

  const search = useCallback(
    async (nextBounds?: FmapBounds) => {
      const area = nextBounds ?? bounds;
      if (!area) return;
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);
      setSearchError(null);
      setSelectedProfileId(null);
      setPreview(null);

      const params = new URLSearchParams({
        north: String(area.north),
        south: String(area.south),
        east: String(area.east),
        west: String(area.west),
        date: filters.date,
        start: filters.start,
        end: filters.end,
        roles: filters.role,
      });
      if (filters.category) params.set("categories", filters.category);

      try {
        const response = await fetch(`/api/fmap/providers?${params}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as SearchResponse;
        if (!response.ok || !body.data)
          throw new Error(body.message || body.error || "search_failed");
        setMarkers(body.data);
        setTruncated(Boolean(body.truncated));
        setHasSearched(true);
        setSearchedFor({
          date: filters.date,
          start: filters.start,
          end: filters.end,
        });
        setMapMoved(false);
        setFiltersExpanded(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError")
          setSearchError(t("errors.search"));
      } finally {
        if (requestRef.current === controller) setLoading(false);
      }
    },
    [bounds, filters, t],
  );

  useEffect(() => {
    if (!bounds || initialSearchRef.current) return;
    initialSearchRef.current = true;
    void search();
  }, [bounds, search]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const selectProvider = useCallback(async (profileId: string) => {
    ignoreNextMoveRef.current = true;
    setSelectedProfileId(profileId);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const response = await fetch(
        `/api/fmap/providers/${encodeURIComponent(profileId)}`,
      );
      const body = (await response.json()) as {
        data: FmapProviderPreview | null;
      };
      if (response.ok && body.data) setPreview(body.data);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const selectProvince = useCallback(
    async (nextProvinceId: string) => {
      setProvinceId(nextProvinceId);
      setProvinceNotice(null);
      if (!nextProvinceId) return;
      try {
        const response = await fetch(
          `/api/fmap/province-bounds?provinceId=${encodeURIComponent(nextProvinceId)}`,
        );
        const body = (await response.json()) as { data: FmapBounds | null };
        if (!response.ok) throw new Error("province_lookup_failed");
        if (!body.data) {
          setProvinceNotice(t("filters.provinceEmpty"));
          return;
        }
        searchAfterFitRef.current = true;
        setFitRequest({ bounds: body.data, nonce: Date.now() });
      } catch {
        setProvinceNotice(t("errors.search"));
      }
    },
    [t],
  );

  const useMyLocation = useCallback(() => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError(t("errors.geolocationUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCentreRequest({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          nonce: Date.now(),
        });
      },
      () => setLocationError(t("errors.geolocationDenied")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [t]);

  const bookingHref = useMemo(() => {
    if (!preview) return null;
    const params = new URLSearchParams({
      date: filters.date,
      time: filters.start,
      end: filters.end,
      role: filters.role,
      source: "fmap",
    });
    if (filters.category) params.set("category", filters.category);
    return `/booking/${preview.providerId}?${params}`;
  }, [filters, preview]);

  const markerLabels = useMemo<MarkerLabels>(
    () => ({
      from: (price) => t("marker.from", { price }),
      contact: t("marker.contact"),
    }),
    [t],
  );

  const openFilters = useCallback(() => {
    setFiltersExpanded(true);
    document
      .getElementById("fmap-filters")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Doubles the visible span around the same centre and re-searches there.
  // Capped well under the API's 6° limit because fitBounds adds padding, so
  // the resulting viewport is a little larger than the box requested here.
  const expandSearchArea = useCallback(() => {
    if (!bounds) return;
    const MAX_SPAN_DEG = 4.5;
    const latCentre = (bounds.north + bounds.south) / 2;
    const lngCentre = (bounds.east + bounds.west) / 2;
    const latHalf =
      Math.min((bounds.north - bounds.south) * 2, MAX_SPAN_DEG) / 2;
    const lngHalf = Math.min((bounds.east - bounds.west) * 2, MAX_SPAN_DEG) / 2;
    searchAfterFitRef.current = true;
    setFitRequest({
      bounds: {
        north: latCentre + latHalf,
        south: latCentre - latHalf,
        east: lngCentre + lngHalf,
        west: lngCentre - lngHalf,
      },
      nonce: Date.now(),
    });
  }, [bounds]);

  return (
    <div className="mx-auto max-w-[1600px] px-3 pt-4 pb-8 sm:px-6 sm:pt-6">
      <div className="mb-3">
        <h1 className="text-display-md text-text-primary">Fmap</h1>
        <p className="text-body-md text-text-secondary">{t("subtitle")}</p>
      </div>
      <FmapFilterBar
        value={filters}
        onChange={setFilters}
        onSearch={() => void search()}
        onUseLocation={useMyLocation}
        isLoading={loading}
        provinceId={provinceId}
        onProvinceChange={(id) => void selectProvince(id)}
        expanded={filtersExpanded}
        onExpandedChange={setFiltersExpanded}
      />
      {locationError ? (
        <p className="mt-2 text-body-sm text-danger">{locationError}</p>
      ) : null}
      {provinceNotice ? (
        <p className="mt-2 text-body-sm text-text-secondary">
          {provinceNotice}
        </p>
      ) : null}

      <div className="relative mt-3 h-[62vh] min-h-[480px] overflow-hidden rounded-[var(--fg-radius-xl)] border border-border-default bg-bg-sunken shadow-[var(--shadow-sm)]">
        {searchedFor ? (
          <p className="absolute top-3 left-3 z-10 max-w-[70%] rounded-full bg-bg-surface/95 px-3 py-1 text-body-sm font-semibold text-text-primary shadow-md">
            {t("context", {
              date: formatDate(`${searchedFor.date}T00:00:00.000Z`),
              start: searchedFor.start,
              end: searchedFor.end,
            })}
          </p>
        ) : null}
        <FmapMap
          markers={markers}
          selectedProfileId={selectedProfileId}
          centreRequest={centreRequest}
          fitRequest={fitRequest}
          onBoundsChange={(nextBounds) => {
            setBounds(nextBounds);
            if (ignoreNextMoveRef.current) {
              ignoreNextMoveRef.current = false;
              return;
            }
            if (searchAfterFitRef.current) {
              searchAfterFitRef.current = false;
              void search(nextBounds);
              return;
            }
            if (hasSearched) setMapMoved(true);
          }}
          onSelectProvider={(profileId) => void selectProvider(profileId)}
          labels={markerLabels}
        />

        {mapMoved ? (
          <Button
            type="button"
            variant="secondary"
            className="absolute top-14 left-1/2 z-10 -translate-x-1/2 shadow-[var(--shadow-md)]"
            disabled={loading}
            onClick={() => void search()}
          >
            {t("searchArea")}
          </Button>
        ) : null}

        {hasSearched && !loading && markers.length === 0 ? (
          <div className="absolute top-4 left-1/2 z-10 w-[min(92%,440px)] -translate-x-1/2 rounded-[var(--fg-radius-lg)] border border-border-default bg-bg-surface/95 p-4 text-center shadow-[var(--shadow-md)] backdrop-blur">
            <p className="font-semibold text-text-primary">
              {t("empty.title")}
            </p>
            <p className="mt-1 text-body-sm text-text-secondary">
              {t("empty.body")}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openFilters}
              >
                {t("empty.changeTime")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={expandSearchArea}
              >
                {t("empty.expandArea")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openFilters}
              >
                {t("empty.changeService")}
              </Button>
            </div>
          </div>
        ) : null}

        {searchError ? (
          <div className="absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-danger-bg px-4 py-2 text-body-sm text-danger shadow-md">
            {searchError}
          </div>
        ) : null}

        {truncated ? (
          <p className="absolute right-3 bottom-3 z-10 rounded-full bg-bg-surface px-3 py-1 text-body-sm text-text-secondary shadow-md">
            {t("truncated")}
          </p>
        ) : null}

        {selectedProfileId ? (
          <FmapProviderPreviewCard
            preview={preview}
            loading={previewLoading}
            bookingHref={bookingHref}
            onClose={() => {
              setSelectedProfileId(null);
              setPreview(null);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
