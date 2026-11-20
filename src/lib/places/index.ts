import type { PlaceKind, ProfileCategory } from "@prisma/client";

import { foldVietnamese } from "@/lib/vietnam/fold";

// Photo spots ("địa điểm chụp", project owner 20/11/2026). Shared by the
// validation schemas, the services and the pages, so the lists below are
// the single source of truth for what a spot can be.

export const PLACE_KINDS: PlaceKind[] = [
  "OLD_QUARTER",
  "STREET",
  "CAFE",
  "PARK",
  "BEACH",
  "MOUNTAIN",
  "FIELD",
  "LAKE_RIVER",
  "HERITAGE",
  "ARCHITECTURE",
  "COUNTRYSIDE",
  "TOURIST_AREA",
  "OTHER",
];

// The shoot styles a spot can be marked as suiting. Only styles that happen
// on location: studio types, make-up looks, model types and costume kinds
// are not about a place.
export const PLACE_CATEGORIES: ProfileCategory[] = [
  "WEDDING",
  "PORTRAIT",
  "YEARBOOK",
  "FASHION",
  "STREET",
  "LANDSCAPE",
  "EVENT",
  "COMMERCIAL",
  "MUSIC_VIDEO",
  "DOCUMENTARY",
];

/** Photos one proposal may carry; an admin can add more later. */
export const MAX_PLACE_PHOTOS = 10;
/** Proposals one person may have waiting for review at a time. */
export const MAX_PENDING_PLACES = 5;
/** Two spots closer than this are probably the same one. */
export const DUPLICATE_RADIUS_M = 200;
/** "Nhà cung cấp gần đây" on a spot's page reach this far. */
export const NEARBY_PROVIDER_RADIUS_KM = 15;

// Vietnam including its islands, generously: a pin outside this box is a
// slip of the finger on the map, not a spot in Vietnam.
export const VIETNAM_BOUNDS = {
  south: 7.5,
  north: 23.6,
  west: 102,
  east: 117.5,
} as const;

/**
 * "Đồi chè Cầu Đất" → "doi-che-cau-dat". The URL part of a spot, unique
 * within its province (services/places.ts adds -2, -3… on a clash).
 */
export function placeSlug(name: string): string {
  const slug = foldVietnamese(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "dia-diem";
}

/** Great-circle distance in metres. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A lat/lng box around a point, `meters` in every direction. */
export function boxAround(
  point: { latitude: number; longitude: number },
  meters: number,
) {
  const dLat = meters / 111_320;
  const dLng =
    meters /
    (111_320 * Math.max(0.2, Math.cos((point.latitude * Math.PI) / 180)));
  return {
    south: point.latitude - dLat,
    north: point.latitude + dLat,
    west: point.longitude - dLng,
    east: point.longitude + dLng,
  };
}

/** Public URL of a spot. */
export function placeHref(place: { slug: string; province: { code: string } }) {
  return `/dia-diem/${place.province.code}/${place.slug}`;
}

/**
 * Months as the page shows them: consecutive months collapse into a range,
 * so [11, 12, 1, 2] reads "Tháng 11 – Tháng 2" rather than four chips.
 * Returns runs of [first, last] month numbers, in calendar order starting
 * from the run that wraps the new year if there is one.
 */
export function monthRuns(months: number[]): [number, number][] {
  const set = new Set(months.filter((m) => m >= 1 && m <= 12));
  if (set.size === 0) return [];
  if (set.size === 12) return [[1, 12]];
  // Start right after a month that is not in the set, so a run that wraps
  // December→January stays one run.
  let start = 1;
  while (set.has(start)) start = (start % 12) + 1;
  const runs: [number, number][] = [];
  let current: [number, number] | null = null;
  for (let i = 0; i < 12; i++) {
    const month = ((start - 1 + i) % 12) + 1;
    if (set.has(month)) {
      if (current) current[1] = month;
      else current = [month, month];
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);
  return runs;
}
