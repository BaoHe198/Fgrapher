import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { placeNearbySchema } from "@/lib/validations/place";
import { canProposePlaces, nearbyPlaces, PlaceError } from "@/services/places";

/**
 * Spots already on the map near a pin — the proposal form asks "is it one
 * of these?" before a duplicate is sent. Only for people who may propose,
 * since it also lists spots still waiting for review.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    if (!(await canProposePlaces(session.user.id))) {
      throw new PlaceError("not_allowed", 403);
    }
    const url = new URL(request.url);
    const parsed = placeNearbySchema.safeParse({
      latitude: url.searchParams.get("lat"),
      longitude: url.searchParams.get("lng"),
      excludeId: url.searchParams.get("exclude") ?? undefined,
    });
    if (!parsed.success) return placeInvalid(parsed.error);
    const nearby = await nearbyPlaces(parsed.data, parsed.data.excludeId);
    return NextResponse.json(
      { data: nearby, error: null, message: null },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) return placeFailure(err);
    return placeFailure(err, "loadFailed");
  }
}
