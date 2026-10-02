"use client";

import { LocateFixed, Minus, Plus, X } from "lucide-react";
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
  fmapRolesParam,
} from "@/components/fmap/fmap-filter-bar";
import type { FmapBounds, MarkerLabels } from "@/components/fmap/fmap-map";
import { FmapProviderPreviewCard } from "@/components/fmap/fmap-provider-preview";
import { Button } from "@/components/ui/button";
import { FgImage } from "@/components/ui/fg-image";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { formatDate, formatVND, vietnamDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";
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

/** Share of the searched area treated as "the edge" on each side. */
const EDGE_MARGIN = 0.12;

function resultsNearEdge(markers: FmapMarker[], area: FmapBounds) {
  if (markers.length === 0) return false;
  const latMargin = (area.north - area.south) * EDGE_MARGIN;
  const lngMargin = (area.east - area.west) * EDGE_MARGIN;
  return markers.some(
    (m) =>
      m.latitude > area.north - latMargin ||
      m.latitude < area.south + latMargin ||
      m.longitude > area.east - lngMargin ||
      m.longitude < area.west + lngMargin,
  );
}

function boundsOf(markers: FmapMarker[]): FmapBounds {
  return {
    north: Math.max(...markers.map((m) => m.latitude)),
    south: Math.min(...markers.map((m) => m.latitude)),
    east: Math.max(...markers.map((m) => m.longitude)),
    west: Math.min(...markers.map((m) => m.longitude)),
  };
}

function defaultFilters(
  role: FmapFilterValue["role"],
  category: FmapFilterValue["category"],
): FmapFilterValue {
  return {
    provinceId: "",
    wardId: "",
    // Two days out: past the 24-hour minimum booking notice, so the first
    // search can actually return providers.
    date: vietnamDateKey(2),
    start: "09:00",
    end: "11:00",
    role,
    category,
  };
}

/** Height of the collapsed results sheet on phones, before the safe area. */
const SHEET_COLLAPSED_PX = 100;

function ResultRow({
  marker,
  selected,
  onSelect,
  roleLabel,
  priceLabel,
}: {
  marker: FmapMarker;
  selected: boolean;
  onSelect: () => void;
  roleLabel: string;
  priceLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "focus-ring grid w-full grid-cols-[88px_minmax(0,1fr)] items-center gap-3 rounded-[var(--fg-radius-md)] border p-2 text-left transition-colors duration-[var(--fg-dur-150)]",
        selected
          ? "border-brand-primary bg-bg-surface"
          : "border-border-subtle bg-bg-surface hover:border-border-strong",
      )}
    >
      {marker.thumbnailUrl ? (
        <FgImage
          src={marker.thumbnailUrl}
          alt=""
          ratio="1/1"
          rounded="sm"
          sizes="88px"
        />
      ) : (
        <span
          aria-hidden
          className="aspect-square rounded-[var(--fg-radius-sm)] bg-bg-sunken"
        />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <strong className="truncate text-body-md font-semibold text-text-primary">
          {marker.displayName}
        </strong>
        <span className="truncate text-body-sm text-text-secondary">
          {roleLabel}
        </span>
        <span className="text-body-sm font-semibold text-text-primary tabular-nums">
          {priceLabel}
        </span>
      </span>
    </button>
  );
}

function MapControl({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="focus-ring grid size-11 place-items-center rounded-full border border-border-default bg-bg-surface text-text-primary shadow-[var(--shadow-sm)] hover:bg-bg-sunken"
    >
      {children}
    </button>
  );
}

export function FmapClient({ initialRole, initialCategory }: FmapClientProps) {
  const t = useTranslations("fmap");
  const v2 = useTranslations("fmap.v2");
  const railT = useTranslations("publicPages.browse.v3.railRoles");
  // The page heading is the same name the site nav uses — "Bản đồ F" in
  // Vietnamese — rather than a hardcoded "Fmap" the nav never called it.
  const navT = useTranslations("nav");
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<FmapFilterValue>(() =>
    defaultFilters(initialRole, initialCategory),
  );
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
    keepZoom?: boolean;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Phones (Core MVP pass): the results live in a sheet over the map,
  // collapsed to its count, or expanded to the list. A chosen provider
  // shows in the collapsed sheet. Panning never re-searches by itself -
  // "Tìm trong khu vực này" appears instead.
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(SHEET_COLLAPSED_PX);
  const sheetRef = useRef<HTMLElement>(null);
  const [zoomRequest, setZoomRequest] = useState<{
    delta: number;
    nonce: number;
  } | null>(null);

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
        roles: fmapRolesParam(current.role),
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
        // A result near the edge of the area searched sat half off the map
        // — the one hit for "photographer, HCMC, 09:00–11:00" was a price
        // tag clipped at the top border, easy to take for "nothing found".
        // Bring results into view, at the same zoom, without that counting
        // as the user moving the map.
        if (resultsNearEdge(body.data, area)) {
          ignoreNextMoveRef.current = true;
          setFitRequest({
            bounds: boundsOf(body.data),
            nonce: Date.now(),
            keepZoom: true,
          });
        }
        setTruncated(Boolean(body.truncated));
        setHasSearched(true);
        setSearchedFor(current);
        setMapMoved(false);
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
      roles: fmapRolesParam(filtersRef.current.role),
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
    setSheetExpanded(false);
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
      role: searchedFor.role || preview.role,
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

  const openFilters = useCallback(() => setFiltersOpen(true), []);

  const resetFilters = useCallback(
    () =>
      setFilters((previous) => ({
        ...defaultFilters(previous.role, ""),
      })),
    [],
  );

  const closePreview = useCallback(() => {
    setSelectedProfileId(null);
    setPreview(null);
    setPreviewError(false);
  }, []);

  // The controls and the map's centring follow the sheet's real height.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setSheetHeight(Math.round(el.getBoundingClientRect().height)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile]);

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

  const priceOf = (marker: FmapMarker) =>
    marker.startingPrice != null
      ? t("marker.from", { price: formatVND(marker.startingPrice) })
      : t("marker.contact");

  const countText = loading
    ? t("filters.searching")
    : searchError
      ? searchError
      : searchedFor
        ? markers.length > 0
          ? v2("countInView", {
              count: markers.length,
              more: truncated ? "+" : "",
            })
          : v2("countNone")
        : "";
  const contextText = searchedFor
    ? t("context", {
        date: formatDate(`${searchedFor.date}T00:00:00.000Z`),
        start: searchedFor.start,
        end: searchedFor.end,
      })
    : "";

  const resultList = (
    <ul className="flex flex-col gap-3">
      {markers.map((marker) => (
        <li key={marker.profileId}>
          <ResultRow
            marker={marker}
            selected={marker.profileId === selectedProfileId}
            onSelect={() => void selectProvider(marker.profileId)}
            roleLabel={railT(marker.role)}
            priceLabel={priceOf(marker)}
          />
        </li>
      ))}
    </ul>
  );

  const clusterList =
    clusterMarkers.length > 0 ? (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-text-primary">
            {t("cluster.title", { count: clusterMarkers.length })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("cluster.close")}
            className="size-11"
            onClick={() => setClusterIds(null)}
          >
            <X />
          </Button>
        </div>
        <ul className="flex flex-col gap-1">
          {clusterMarkers.map((marker) => (
            <li key={marker.profileId}>
              <button
                type="button"
                onClick={() => void selectProvider(marker.profileId)}
                className="focus-ring flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--fg-radius-md)] px-2 text-left hover:bg-bg-sunken"
              >
                <span className="truncate text-body-md text-text-primary">
                  {marker.displayName}
                </span>
                <span className="shrink-0 text-body-sm font-semibold text-text-secondary">
                  {priceOf(marker)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const previewCard = selectedProfileId ? (
    <FmapProviderPreviewCard
      preview={preview}
      loading={previewLoading}
      error={previewError}
      onRetry={() => void selectProvider(selectedProfileId)}
      bookingHref={bookingHref}
      onClose={closePreview}
      inline={isMobile}
    />
  ) : null;

  const controlsBottom = isMobile ? sheetHeight + 12 : 24;

  return (
    // Full-bleed under the site header: the compact search row and role
    // rail on top; the results list on the left from 768px, or a sheet
    // over the map on phones.
    <div className="flex h-[calc(100dvh-73px)] min-h-[560px] flex-col">
      <h1 className="sr-only">{navT("fmap")}</h1>
      <FmapFilterBar
        value={filters}
        onChange={setFilters}
        onReset={resetFilters}
        onUseLocation={useMyLocation}
        isLoading={loading}
        invalidReason={invalidReason}
        resultCount={searchedFor ? markers.length : null}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
      />
      {notice ? (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "border-b border-border-subtle bg-danger-bg px-4 py-2 text-body-sm text-danger md:px-6"
              : "border-b border-border-subtle bg-bg-sunken px-4 py-2 text-body-sm text-text-secondary md:px-6"
          }
        >
          {notice.text}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        <aside
          aria-label={v2("results")}
          className="flex w-[400px] shrink-0 flex-col border-r border-border-subtle bg-bg-page max-md:hidden"
        >
          <div className="px-4 py-3">
            <p
              role={isMobile ? undefined : "status"}
              aria-live={isMobile ? undefined : "polite"}
              className="text-body-md font-semibold text-text-primary"
            >
              {countText}
            </p>
            {contextText ? (
              <p className="text-body-sm text-text-secondary">{contextText}</p>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {resultList}
          </div>
        </aside>

        <div
          role="region"
          aria-label={navT("fmap")}
          className="relative min-w-0 flex-1 overflow-hidden bg-bg-sunken"
        >
          <FmapMap
            markers={markers}
            selectedProfileId={selectedProfileId}
            centreRequest={centreRequest}
            fitRequest={fitRequest}
            zoomRequest={zoomRequest}
            bottomInset={isMobile ? sheetHeight : 0}
            onBoundsChange={(nextBounds, byUser) => {
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
              if (!hasSearched || !byUser) return;
              setMapMoved(true);
            }}
            onSelectProvider={(profileId) => void selectProvider(profileId)}
            onSelectCluster={(profileIds) => {
              setSelectedProfileId(null);
              setPreview(null);
              setSheetExpanded(false);
              setClusterIds(profileIds);
            }}
            labels={markerLabels}
          />

          {mapMoved ? (
            <Button
              type="button"
              variant="primary"
              className="absolute top-3 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-full px-5 whitespace-nowrap shadow-[var(--shadow-md)]"
              disabled={loading || invalidReason != null}
              onClick={() => void search()}
            >
              {t("searchArea")}
            </Button>
          ) : null}

          {hasSearched && !loading && !searchError && markers.length === 0 ? (
            <div
              className={cn(
                "absolute left-1/2 z-10 w-[min(92%,440px)] -translate-x-1/2 rounded-[var(--fg-radius-lg)] border border-border-default bg-bg-surface/95 p-4 text-center shadow-[var(--shadow-md)] backdrop-blur",
                mapMoved ? "top-16" : "top-3",
              )}
            >
              <p className="font-semibold text-text-primary">
                {t("empty.title")}
              </p>
              <p className="mt-1 text-body-sm text-text-secondary">
                {t("empty.body")}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="secondary" onClick={openFilters}>
                  {t("empty.changeTime")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={expandSearchArea}
                >
                  {t("empty.expandArea")}
                </Button>
                {filters.wardId ? (
                  <Button
                    type="button"
                    variant="secondary"
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
              className="absolute top-3 left-1/2 z-10 w-max max-w-[92%] -translate-x-1/2 rounded-[var(--fg-radius-lg)] bg-danger-bg px-4 py-2 text-center text-body-sm text-danger shadow-md"
            >
              {searchError}
            </div>
          ) : null}

          {/* Locate, zoom in, zoom out: 44px, 8px apart, always above the
              sheet's edge; hidden while the list covers the map. */}
          {!(isMobile && sheetExpanded) ? (
            <div
              role="group"
              aria-label={v2("controls")}
              style={{ bottom: controlsBottom }}
              className="absolute right-3 z-15 flex flex-col gap-2 transition-[bottom] duration-[var(--fg-dur-260)] ease-fg-out motion-reduce:transition-none"
            >
              <MapControl
                label={t("filters.myLocation")}
                onClick={useMyLocation}
              >
                <LocateFixed className="size-5" />
              </MapControl>
              <MapControl
                label={v2("zoomIn")}
                onClick={() => setZoomRequest({ delta: 1, nonce: Date.now() })}
              >
                <Plus className="size-5" />
              </MapControl>
              <MapControl
                label={v2("zoomOut")}
                onClick={() => setZoomRequest({ delta: -1, nonce: Date.now() })}
              >
                <Minus className="size-5" />
              </MapControl>
            </div>
          ) : null}

          {!isMobile ? (
            <>
              {clusterList ? (
                <aside className="absolute top-3 right-3 z-20 max-h-[60%] w-[340px] overflow-y-auto rounded-[var(--fg-radius-xl)] border border-border-subtle bg-surface-card p-3 shadow-[var(--shadow-lg)]">
                  {clusterList}
                </aside>
              ) : null}
              {previewCard}
            </>
          ) : (
            <section
              ref={sheetRef}
              aria-label={v2("results")}
              className={cn(
                "absolute inset-x-0 bottom-0 z-25 flex flex-col rounded-t-[var(--fg-radius-xl)] bg-bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_hsl(30_14%_5%/0.14)]",
                sheetExpanded
                  ? "h-[78%]"
                  : selectedProfileId || clusterList
                    ? "max-h-[75%]"
                    : "min-h-[100px]",
              )}
            >
              <button
                type="button"
                onClick={() => setSheetExpanded((open) => !open)}
                aria-expanded={sheetExpanded}
                aria-label={
                  sheetExpanded ? v2("collapseList") : v2("expandList")
                }
                className="focus-ring flex h-11 shrink-0 items-center justify-center rounded-t-[var(--fg-radius-xl)]"
              >
                <span
                  aria-hidden
                  className="h-1 w-10 rounded-full bg-border-default"
                />
              </button>
              <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2.5">
                <p
                  role="status"
                  aria-live="polite"
                  className="min-w-0 text-body-md font-semibold text-pretty text-text-primary"
                >
                  {countText}
                </p>
                {markers.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSheetExpanded((open) => !open)}
                    className="focus-ring min-h-11 shrink-0 rounded-[var(--fg-radius-sm)] px-1 text-body-md font-semibold text-text-link"
                  >
                    {sheetExpanded ? v2("seeMap") : v2("seeList")}
                  </button>
                ) : null}
              </div>
              {sheetExpanded ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                  {resultList}
                </div>
              ) : clusterList ? (
                <div className="min-h-0 overflow-y-auto px-4 pb-4">
                  {clusterList}
                </div>
              ) : previewCard ? (
                <div className="min-h-0 overflow-y-auto border-t border-border-subtle">
                  {previewCard}
                </div>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
