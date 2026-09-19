import { createHash } from "node:crypto";

const MAPTILER_GEOCODING_URL = "https://api.maptiler.com/geocoding";
const DEFAULT_TIMEOUT_MS = 5_000;

export interface GeocodeAddress {
  address: string;
  ward: string;
  province: string;
}

export type GeocodeFailureReason =
  | "not_configured"
  | "timeout"
  | "upstream_error"
  | "not_found"
  | "invalid_response";

export type GeocodeResult =
  | { success: true; latitude: number; longitude: number }
  | { success: false; reason: GeocodeFailureReason };

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

export async function forwardGeocode(
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
