import type {
  AddressSuggestion,
  GeocodeAddress,
  GeocodeResult,
  SuggestResult,
} from "@/services/geocoding-types";
import { joinAddressParts } from "@/services/geocoding-types";

// Goong (goong.io) is a Vietnamese maps provider. Unlike MapTiler it
// answers Vietnamese addresses down to the house number and alley, which
// is what providers actually type — see docs/ops/fmap.md.
//
// Its autocomplete returns place ids without coordinates, so picking a
// suggestion needs a second "Place/Detail" call. That is why
// AddressSuggestion carries optional coordinates.
const GOONG_BASE_URL = "https://rsapi.goong.io";
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_SUGGESTIONS = 5;

export interface GoongOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function key(options: GoongOptions) {
  return options.apiKey ?? process.env.GOONG_API_KEY;
}

async function request<T>(
  url: URL,
  options: GoongOptions,
): Promise<
  { ok: true; data: T } | { ok: false; reason: "timeout" | "upstream_error" }
> {
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
    if (!response.ok) return { ok: false, reason: "upstream_error" };
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "upstream_error" };
  } finally {
    clearTimeout(timeout);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

interface GoongPredictions {
  predictions?: Array<{ description?: unknown; place_id?: unknown }>;
}

/** Address autocomplete. Coordinates arrive later via resolveGoongPlace. */
export async function suggestGoongAddresses(
  query: string,
  context: { ward?: string; province?: string },
  options: GoongOptions = {},
): Promise<SuggestResult> {
  const apiKey = key(options);
  if (!apiKey) return { success: false, reason: "not_configured" };

  const url = new URL(`${GOONG_BASE_URL}/Place/AutoComplete`);
  url.searchParams.set("api_key", apiKey);
  // The ward/province already chosen in the form keep suggestions local.
  url.searchParams.set(
    "input",
    joinAddressParts([query, context.ward, context.province]),
  );
  url.searchParams.set("limit", String(MAX_SUGGESTIONS));

  const result = await request<GoongPredictions>(url, options);
  if (!result.ok) return { success: false, reason: result.reason };

  const suggestions: AddressSuggestion[] = [];
  for (const prediction of result.data.predictions ?? []) {
    if (
      typeof prediction.description !== "string" ||
      prediction.description.trim() === "" ||
      typeof prediction.place_id !== "string"
    ) {
      continue;
    }
    suggestions.push({
      id: prediction.place_id,
      label: prediction.description,
    });
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return { success: true, suggestions };
}

interface GoongPlaceDetail {
  result?: { geometry?: { location?: { lat?: unknown; lng?: unknown } } };
}

/** Coordinates of one suggestion the provider picked. */
export async function resolveGoongPlace(
  placeId: string,
  options: GoongOptions = {},
): Promise<GeocodeResult> {
  const apiKey = key(options);
  if (!apiKey) return { success: false, reason: "not_configured" };

  const url = new URL(`${GOONG_BASE_URL}/Place/Detail`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("place_id", placeId);

  const result = await request<GoongPlaceDetail>(url, options);
  if (!result.ok) return { success: false, reason: result.reason };

  const location = result.data.result?.geometry?.location;
  if (!location) return { success: false, reason: "not_found" };
  if (!isFiniteNumber(location.lat) || !isFiniteNumber(location.lng)) {
    return { success: false, reason: "invalid_response" };
  }
  return { success: true, latitude: location.lat, longitude: location.lng };
}

interface GoongGeocode {
  results?: Array<{
    geometry?: { location?: { lat?: unknown; lng?: unknown } };
  }>;
}

/** Address text -> point, for saves where nothing was picked from the list. */
export async function goongForwardGeocode(
  input: GeocodeAddress,
  options: GoongOptions = {},
): Promise<GeocodeResult> {
  const apiKey = key(options);
  if (!apiKey) return { success: false, reason: "not_configured" };

  const url = new URL(`${GOONG_BASE_URL}/geocode`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set(
    "address",
    joinAddressParts([input.address, input.ward, input.province, "Việt Nam"]),
  );

  const result = await request<GoongGeocode>(url, options);
  if (!result.ok) return { success: false, reason: result.reason };

  const location = result.data.results?.[0]?.geometry?.location;
  if (!location) return { success: false, reason: "not_found" };
  if (!isFiniteNumber(location.lat) || !isFiniteNumber(location.lng)) {
    return { success: false, reason: "invalid_response" };
  }
  return { success: true, latitude: location.lat, longitude: location.lng };
}
