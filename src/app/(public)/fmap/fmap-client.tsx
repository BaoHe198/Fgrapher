"use client";

import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FmapFilterBar,
  type FmapFilterValue,
} from "@/components/fmap/fmap-filter-bar";
import type { FmapBounds, MarkerLabels } from "@/components/fmap/fmap-map";
import { FmapProviderPreviewCard } from "@/components/fmap/fmap-provider-preview";
import { Button } from "@/components/ui/button";
import { formatDate, formatVND, vietnamDateKey } from "@/lib/format";
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

// Mirrors the API's limits (src/lib/validations/fmap.ts) so an invalid
// search is explained next to the filters instead of failing server-side.
const MAX_AREA_DEG = 6;
const MIN_WINDOW_MINUTES = 30;
const MAX_WINDOW_MINUTES = 12 * 60;
const AUTO_SEARCH_DELAY_MS = 400;
// A requested map move that ends up not moving (already there) never fires
// moveend; after this long the pending search runs anyway.
const MOVE_FALLBACK_MS = 1500;

type SearchResponse = {
  data: FmapMarker[] | null;
  truncated?: boolean;
  error: string | null;
  message: string | null;
  issues?: Record<string, string[] | undefined>;
};

type Translate = ReturnType<typeof useTranslations<"fmap">>;

function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function filtersProblem(filters: FmapFilterValue, t: Translate) {
  if (!filters.date) return t("errors.missingDate");
  const duration = minutes(filters.end) - minutes(filters.start);
  if (duration <= 0) return t("filters.invalidTime");
  if (duration < MIN_WINDOW_MINUTES || duration > MAX_WINDOW_MINUTES)
    return t("errors.timeRange");
  return null;
}

function areaTooLarge(area: FmapBounds) {
  return (
    area.north - area.south > MAX_AREA_DEG ||
    area.east - area.west > MAX_AREA_DEG
  );
}

interface FmapClientProps {
  initialRole: FmapFilterValue["role"];
  initialCategory: FmapFilterValue["category"];
}

export function FmapClient({ initialRole, initialCategory }: FmapClientProps) {
  const t = useTranslations("fmap");
  const [filters, setFilters] = useState<FmapFilterValue>({
    provinceId: "",
    wardId: "",
    // Two days out: past the 24-hour minimum booking notice, so the first
    // search can actually return providers.
    date: vietnamDateKey(2),
    start: "09:00",
    end: "11:00",
    role: initialRole,
    category: initialCategory,
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
  const [fitRequest, setFitRequest] = useState<{
    bounds: FmapBounds;
    nonce: number;
  } | null>(null);
  const [notice, setNotice] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [clusterIds, setClusterIds] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<FmapProviderPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  // What the markers on screen were actually searched for. The booking
  // link and the "Available …" chip read this, not the live form, so
  // editing a field without searching can't send a stale availability
  // claim into the booking flow.
  const [searchedFor, setSearchedFor] = useState<FmapFilterValue | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const filtersRef = useRef(filters);
  const boundsRef = useRef(bounds);
  const requestRef = useRef<AbortController | null>(null);
  const initialSearchRef = useRef(false);
  const searchAfterMoveRef = useRef(false);
  const ignoreNextMoveRef = useRef(false);
  const moveFallbackRef = useRef<number | null>(null);
  useEffect(() => {
    filtersRef.current = filters;
    boundsRef.current = bounds;
  }, [filters, bounds]);

  const invalidReason = filtersProblem(filters, t);

  const search = useCallback(
    async (nextBounds?: FmapBounds) => {
      const area = nextBounds ?? boundsRef.current;
      const current = filtersRef.current;
      if (!area || filtersProblem(current, t)) return;
      requestRef.current?.abort();
      setSelectedProfileId(null);
      setClusterIds(null);
      setPreview(null);
      if (areaTooLarge(area)) {
        setSearchError(t("errors.tooLarge"));
        setMapMoved(false);
        return;
      }
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);
      setSearchError(null);

      const params = new URLSearchParams({
        north: String(area.north),
        south: String(area.south),
        east: String(area.east),
        west: String(area.west),
        date: current.date,
        start: current.start,
        end: current.end,
        roles: current.role,
      });
      if (current.category) params.set("categories", current.category);
      if (current.wardId) params.set("wardId", current.wardId);

      try {
        const response = await fetch(`/api/fmap/providers?${params}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as SearchResponse;
        if (!response.ok || !body.data) {
          setSearchError(
            body.issues?.north ? t("errors.tooLarge") : t("errors.search"),
          );
          return;
        }
        setMarkers(body.data);
        setTruncated(Boolean(body.truncated));
        setHasSearched(true);
        setSearchedFor(current);
        setMapMoved(false);
        setFiltersExpanded(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError")
          setSearchError(t("errors.search"));
      } finally {
        if (requestRef.current === controller) setLoading(false);
      }
    },
    [t],
  );

  // Search once the map has finished moving to a requested place (GPS,
  // province, ward, "expand area").
  const searchAfterMove = useCallback(() => {
    searchAfterMoveRef.current = true;
    if (moveFallbackRef.current) window.clearTimeout(moveFallbackRef.current);
    moveFallbackRef.current = window.setTimeout(() => {
      if (!searchAfterMoveRef.current) return;
      searchAfterMoveRef.current = false;
      void search();
    }, MOVE_FALLBACK_MS);
  }, [search]);

  useEffect(() => {
    if (!bounds || initialSearchRef.current) return;
    initialSearchRef.current = true;
    void search(bounds);
  }, [bounds, search]);

  // Results follow the time/service filters without an extra click.
  const { date, start, end, role, category } = filters;
  useEffect(() => {
    if (!initialSearchRef.current) return;
    const timer = window.setTimeout(() => void search(), AUTO_SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [date, start, end, role, category, search]);

  // Province/ward: zoom to where that area's providers are, then search
  // (restricted to the ward, if one is chosen).
  const { provinceId, wardId } = filters;
  useEffect(() => {
    if (!provinceId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      provinceId,
      roles: filtersRef.current.role,
    });
    if (wardId) params.set("wardId", wardId);
    startTransition(() => setNotice(null));
    fetch(`/api/fmap/province-bounds?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { data: FmapBounds | null };
        if (!response.ok) throw new Error("area_lookup_failed");
        if (!body.data) {
          // Nothing to show here: clear the previous area's markers rather
          // than leave them on screen under a "no providers" notice.
          setMarkers([]);
          setSearchedFor(null);
          setNotice({
            tone: "info",
            text: wardId ? t("filters.wardEmpty") : t("filters.provinceEmpty"),
          });
          return;
        }
        searchAfterMove();
        setFitRequest({ bounds: body.data, nonce: Date.now() });
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError")
          setNotice({ tone: "error", text: t("errors.search") });
      });
    return () => controller.abort();
  }, [provinceId, wardId, searchAfterMove, t]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      if (moveFallbackRef.current) window.clearTimeout(moveFallbackRef.current);
    },
    [],
  );

  const selectProvider = useCallback(async (profileId: string) => {
    ignoreNextMoveRef.current = true;
    window.setTimeout(() => {
      ignoreNextMoveRef.current = false;
    }, MOVE_FALLBACK_MS);
    setClusterIds(null);
    setSelectedProfileId(profileId);
    setPreview(null);
    setPreviewError(false);
    setPreviewLoading(true);
    try {
      const response = await fetch(
        `/api/fmap/providers/${encodeURIComponent(profileId)}`,
      );
      const body = (await response.json()) as {
        data: FmapProviderPreview | null;
      };
      if (response.ok && body.data) setPreview(body.data);
      else setPreviewError(true);
    } catch {
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const useMyLocation = useCallback(() => {
    setNotice(null);
    if (!navigator.geolocation) {
      setNotice({ tone: "error", text: t("errors.geolocationUnavailable") });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // The customer's own position replaces any province/ward focus.
        setFilters((previous) => ({ ...previous, provinceId: "", wardId: "" }));
        searchAfterMove();
        setCentreRequest({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          nonce: Date.now(),
        });
      },
      () => setNotice({ tone: "error", text: t("errors.geolocationDenied") }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [searchAfterMove, t]);

  const bookingHref = useMemo(() => {
    if (!preview || !searchedFor) return null;
    const params = new URLSearchParams({
      date: searchedFor.date,
      time: searchedFor.start,
      end: searchedFor.end,
      role: searchedFor.role,
      source: "fmap",
    });
    if (searchedFor.category) params.set("category", searchedFor.category);
    return `/booking/${preview.providerId}?${params}`;
  }, [searchedFor, preview]);

  const markerLabels = useMemo<MarkerLabels>(
    () => ({
      from: (price) => t("marker.from", { price }),
      contact: t("marker.contact"),
    }),
    [t],
  );

  const clusterMarkers = useMemo(
    () =>
      clusterIds
        ? markers.filter((marker) => clusterIds.includes(marker.profileId))
        : [],
    [clusterIds, markers],
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
    searchAfterMove();
    setFitRequest({
      bounds: {
        north: latCentre + latHalf,
        south: latCentre - latHalf,
        east: lngCentre + lngHalf,
        west: lngCentre - lngHalf,
      },
      nonce: Date.now(),
    });
  }, [bounds, searchAfterMove]);

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
        invalidReason={invalidReason}
        expanded={filtersExpanded}
        onExpandedChange={setFiltersExpanded}
      />
      {notice ? (
        <p
          className={
            notice.tone === "error"
              ? "mt-2 text-body-sm text-danger"
              : "mt-2 text-body-sm text-text-secondary"
          }
        >
          {notice.text}
        </p>
      ) : null}

      <div className="relative mt-3 h-[62vh] min-h-[480px] overflow-hidden rounded-[var(--fg-radius-xl)] border border-border-default bg-bg-sunken shadow-[var(--shadow-sm)]">
        {searchedFor ? (
          <p className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-bg-surface/95 px-3 py-1 text-body-sm font-semibold text-text-primary shadow-md">
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
            if (searchAfterMoveRef.current) {
              searchAfterMoveRef.current = false;
              void search(nextBounds);
              return;
            }
            if (hasSearched) setMapMoved(true);
          }}
          onSelectProvider={(profileId) => void selectProvider(profileId)}
          onSelectCluster={(profileIds) => {
            setSelectedProfileId(null);
            setPreview(null);
            setClusterIds(profileIds);
          }}
          labels={markerLabels}
        />

        {mapMoved ? (
          <Button
            type="button"
            variant="secondary"
            className="absolute top-14 left-1/2 z-10 -translate-x-1/2 shadow-[var(--shadow-md)]"
            disabled={loading || invalidReason != null}
            onClick={() => void search()}
          >
            {t("searchArea")}
          </Button>
        ) : null}

        {hasSearched && !loading && !searchError && markers.length === 0 ? (
          <div className="absolute top-14 left-1/2 z-10 w-[min(92%,440px)] -translate-x-1/2 rounded-[var(--fg-radius-lg)] border border-border-default bg-bg-surface/95 p-4 text-center shadow-[var(--shadow-md)] backdrop-blur">
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
              {filters.wardId ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setFilters((previous) => ({ ...previous, wardId: "" }))
                  }
                >
                  {t("empty.clearWard")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {searchError ? (
          <div
            role="alert"
            className="absolute top-14 left-1/2 z-10 w-max max-w-[92%] -translate-x-1/2 rounded-[var(--fg-radius-lg)] bg-danger-bg px-4 py-2 text-center text-body-sm text-danger shadow-md"
          >
            {searchError}
          </div>
        ) : null}

        {truncated ? (
          <p className="absolute right-3 bottom-3 z-10 rounded-full bg-bg-surface px-3 py-1 text-body-sm text-text-secondary shadow-md">
            {t("truncated")}
          </p>
        ) : null}

        {clusterMarkers.length > 0 ? (
          <aside className="absolute right-3 bottom-3 left-3 z-10 max-h-[60%] overflow-y-auto rounded-[var(--fg-radius-xl)] border border-border-default bg-bg-surface p-3 shadow-[var(--shadow-xl)] sm:top-3 sm:bottom-auto sm:left-auto sm:w-[340px]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold text-text-primary">
                {t("cluster.title", { count: clusterMarkers.length })}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("cluster.close")}
                onClick={() => setClusterIds(null)}
              >
                <X />
              </Button>
            </div>
            <ul className="space-y-1">
              {clusterMarkers.map((marker) => (
                <li key={marker.profileId}>
                  <button
                    type="button"
                    onClick={() => void selectProvider(marker.profileId)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--fg-radius-md)] px-2 py-2 text-left hover:bg-bg-sunken"
                  >
                    <span className="truncate text-body-md text-text-primary">
                      {marker.displayName}
                    </span>
                    <span className="shrink-0 text-body-sm font-semibold text-text-secondary">
                      {marker.startingPrice != null
                        ? formatVND(marker.startingPrice)
                        : t("marker.contact")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        {selectedProfileId ? (
          <FmapProviderPreviewCard
            preview={preview}
            loading={previewLoading}
            error={previewError}
            onRetry={() => void selectProvider(selectedProfileId)}
            bookingHref={bookingHref}
            onClose={() => {
              setSelectedProfileId(null);
              setPreview(null);
              setPreviewError(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
