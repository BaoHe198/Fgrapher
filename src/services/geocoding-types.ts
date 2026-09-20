// Shared vocabulary for every geocoding provider (MapTiler, Goong), kept
// in its own module so a provider file never imports the dispatcher.

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

export interface AddressSuggestion {
  id: string;
  label: string;
  /** Absent for providers whose autocomplete needs a second lookup. */
  latitude?: number;
  longitude?: number;
}

export type SuggestResult =
  | { success: true; suggestions: AddressSuggestion[] }
  | { success: false; reason: GeocodeFailureReason };

export const MIN_SUGGEST_QUERY_LENGTH = 3;

/** "12 Lê Lợi", "Phường Sài Gòn" -> "12 Lê Lợi, Phường Sài Gòn". */
export function joinAddressParts(parts: (string | undefined)[]) {
  return parts
    .map((part) => part?.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join(", ");
}
