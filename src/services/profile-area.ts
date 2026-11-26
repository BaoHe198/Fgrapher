import { obfuscateCoordinates } from "@/services/fmap";

/** Where a public profile may place its owner on a map. */
export interface ProfileMapPoint {
  latitude: number;
  longitude: number;
  /**
   * True only for a studio that chose to show where it is: the map may put
   * a pin on this point. Otherwise the point is a neighbourhood, and the map
   * draws an area around it, never a pin.
   */
  exact: boolean;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The point the profile's small map is centred on (project owner,
 * 26/11/2026: "Khu vực làm việc có bản đồ thu nhỏ thật").
 *
 * The stored coordinates are the provider's geocoded street address, which
 * for a freelancer is usually their home. So:
 *
 * - A studio that has turned off "làm mờ vị trí" (Profile.hideExactLocation
 *   = false) is a place customers travel to: the exact point, with a pin.
 * - Everyone else gets a point that cannot be walked back to the door. If
 *   they blur their Fmap position, the same keyed offset Fmap applies is
 *   applied first; then the result is rounded to two decimals, a grid of
 *   roughly one kilometre. This is deliberately coarser than Fmap, which
 *   shows an unblurred provider at their exact address: a profile's area
 *   map only has to say "around here".
 *
 * Decided on the server. The exact coordinates never reach the browser
 * unless `exact` is true.
 */
export function profileMapPoint(profile: {
  id: string;
  role: string;
  latitude: number | null;
  longitude: number | null;
  hideExactLocation: boolean;
}): ProfileMapPoint | null {
  if (profile.latitude == null || profile.longitude == null) return null;
  if (profile.role === "STUDIO" && !profile.hideExactLocation) {
    return {
      latitude: profile.latitude,
      longitude: profile.longitude,
      exact: true,
    };
  }
  const base = profile.hideExactLocation
    ? obfuscateCoordinates(profile.id, profile.latitude, profile.longitude)
    : { latitude: profile.latitude, longitude: profile.longitude };
  return {
    latitude: round(base.latitude),
    longitude: round(base.longitude),
    exact: false,
  };
}
