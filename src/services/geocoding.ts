import { createHash } from "node:crypto";

import {
  goongForwardGeocode,
  resolveGoongPlace,
  suggestGoongAddresses,
} from "@/services/goong";
import {
  joinAddressParts,
  MIN_SUGGEST_QUERY_LENGTH,
  type AddressSuggestion,
  type GeocodeAddress,
  type GeocodeFailureReason,
  type GeocodeResult,
  type SuggestResult,
} from "@/services/geocoding-types";

export {
  MIN_SUGGEST_QUERY_LENGTH,
  type AddressSuggestion,
  type GeocodeAddress,
  type GeocodeFailureReason,
  type GeocodeResult,
  type SuggestResult,
};

const MAPTILER_GEOCODING_URL = "https://api.maptiler.com/geocoding";
const DEFAULT_TIMEOUT_MS = 5_000;

interface MapTilerFeatureCollection {
  features?: Array<{
    geometry?: { type?: string; coordinates?: unknown };
  }>;
}

interface ForwardGeocodeOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function normalizeAddressPart(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildGeocodeAddressHash(input: GeocodeAddress) {
  const normalized = [input.address, input.ward, input.province]
    .map(normalizeAddressPart)
    .join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

export async function maptilerForwardGeocode(
  input: GeocodeAddress,
  options: ForwardGeocodeOptions = {},
): Promise<GeocodeResult> {
  const apiKey = options.apiKey ?? process.env.MAPTILER_API_KEY;
  if (!apiKey) return { success: false, reason: "not_configured" };

  const query = [input.address, input.ward, input.province, "Việt Nam"]
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(", ");
  const url = new URL(
    `${MAPTILER_GEOCODING_URL}/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("country", "vn");
  url.searchParams.set("language", "vi");
  url.searchParams.set("limit", "1");
  url.searchParams.set("autocomplete", "false");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { success: false, reason: "upstream_error" };

    const data = (await response.json()) as MapTilerFeatureCollection;
    const feature = data.features?.[0];
    if (!feature) return { success: false, reason: "not_found" };
    if (
      feature.geometry?.type !== "Point" ||
      !isCoordinatePair(feature.geometry.coordinates)
    ) {
      return { success: false, reason: "invalid_response" };
    }

    const [longitude, latitude] = feature.geometry.coordinates;
    return { success: true, latitude, longitude };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, reason: "timeout" };
    }
    return { success: false, reason: "upstream_error" };
  } finally {
    clearTimeout(timeout);
  }
}

// MapTiler answers an address query with administrative areas too ("Phường
// Thủ Đức"). Picking one would store a ward centroid as the provider's
// address, so only street-level and finer results are offered.
const ADMINISTRATIVE_PLACE_TYPES = new Set([
  "country",
  "region",
  "subregion",
  "county",
  "joint_municipality",
  "joint_submunicipality",
  "municipality",
  "municipal_district",
  "postal_code",
]);
const MAX_SUGGESTIONS = 5;

/**
 * Autocomplete for the provider's detailed address. `context` (ward and
 * province names already chosen in the form) is appended to the query so
 * suggestions stay in the right place; results are limited to Vietnam.
 */
async function suggestMapTilerAddresses(
  query: string,
  context: { ward?: string; province?: string },
  options: ForwardGeocodeOptions = {},
): Promise<SuggestResult> {
  const apiKey = options.apiKey ?? process.env.MAPTILER_API_KEY;
  if (!apiKey) return { success: false, reason: "not_configured" };

  const trimmedQuery = query.trim();
  const text = joinAddressParts([trimmedQuery, context.ward, context.province]);

  const url = new URL(
    `${MAPTILER_GEOCODING_URL}/${encodeURIComponent(text)}.json`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("country", "vn");
  url.searchParams.set("language", "vi");
  url.searchParams.set("limit", String(MAX_SUGGESTIONS));
  url.searchParams.set("autocomplete", "true");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { success: false, reason: "upstream_error" };

    const data = (await response.json()) as MapTilerFeatureCollection & {
      features?: Array<{
        id?: unknown;
        place_name?: unknown;
        place_type?: unknown;
        geometry?: { coordinates?: unknown };
      }>;
    };

    const suggestions: AddressSuggestion[] = [];
    if (data.features) {
      for (
        let i = 0;
        i < data.features.length && suggestions.length < MAX_SUGGESTIONS;
        i++
      ) {
        const feature = data.features[i];
        const placeTypes = Array.isArray(feature.place_type)
          ? feature.place_type.map(String)
          : [];
        if (placeTypes.some((type) => ADMINISTRATIVE_PLACE_TYPES.has(type))) {
          continue;
        }
        if (
          feature.geometry?.type === "Point" &&
          isCoordinatePair(feature.geometry.coordinates) &&
          typeof feature.place_name === "string" &&
          feature.place_name.trim() !== ""
        ) {
          const [longitude, latitude] = feature.geometry.coordinates;
          suggestions.push({
            id: String(feature.id ?? i),
            label: feature.place_name,
            longitude,
            latitude,
          });
        }
      }
    }

    return { success: true, suggestions };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, reason: "timeout" };
    }
    return { success: false, reason: "upstream_error" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Which provider answers address lookups. Goong (a Vietnamese provider)
 * resolves Vietnamese addresses down to house numbers and alleys, which
 * MapTiler does not, so it wins whenever its key is configured. MapTiler
 * stays as the fallback and keeps serving the map tiles either way.
 */
function activeProvider(): "goong" | "maptiler" {
  const configured = process.env.GEOCODING_PROVIDER?.trim().toLowerCase();
  if (configured === "goong" || configured === "maptiler") return configured;
  return process.env.GOONG_API_KEY ? "goong" : "maptiler";
}

export async function forwardGeocode(
  input: GeocodeAddress,
  options: ForwardGeocodeOptions = {},
): Promise<GeocodeResult> {
  return activeProvider() === "goong"
    ? goongForwardGeocode(input, options)
    : maptilerForwardGeocode(input, options);
}

export async function suggestAddresses(
  query: string,
  context: { ward?: string; province?: string },
  options: ForwardGeocodeOptions = {},
): Promise<SuggestResult> {
  if (query.trim().length < MIN_SUGGEST_QUERY_LENGTH) {
    return { success: true, suggestions: [] };
  }
  return activeProvider() === "goong"
    ? suggestGoongAddresses(query, context, options)
    : suggestMapTilerAddresses(query, context, options);
}

/**
 * Coordinates for a suggestion whose autocomplete entry had none (Goong).
 * MapTiler suggestions already carry their point, so there is nothing to
 * resolve there.
 */
export async function resolveSuggestion(
  suggestionId: string,
  options: ForwardGeocodeOptions = {},
): Promise<GeocodeResult> {
  return activeProvider() === "goong"
    ? resolveGoongPlace(suggestionId, options)
    : { success: false, reason: "not_found" };
}
