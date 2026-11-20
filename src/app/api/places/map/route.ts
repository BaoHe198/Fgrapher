import { NextResponse } from "next/server";

import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { placeMapSchema } from "@/lib/validations/place";
import { placesInBounds } from "@/services/places";

/** Fmap's "Địa điểm chụp" layer: public spots inside the visible map. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = placeMapSchema.safeParse({
      north: url.searchParams.get("north"),
      south: url.searchParams.get("south"),
      east: url.searchParams.get("east"),
      west: url.searchParams.get("west"),
      kinds: url.searchParams.getAll("kind"),
      categories: url.searchParams.getAll("category"),
    });
    if (!parsed.success) return placeInvalid(parsed.error);
    const data = await placesInBounds(parsed.data);
    return NextResponse.json(
      { data, error: null, message: null },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err, "loadFailed");
  }
}
