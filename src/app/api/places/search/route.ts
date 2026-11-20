import { NextResponse } from "next/server";

import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { placeSearchSchema } from "@/lib/validations/place";
import { searchApprovedPlaces } from "@/services/places";

/** Approved spots by name — the album form's "Chụp tại" picker. Public data. */
export async function GET(request: Request) {
  try {
    const parsed = placeSearchSchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    });
    if (!parsed.success) return placeInvalid(parsed.error);
    const data = await searchApprovedPlaces(parsed.data.q);
    return NextResponse.json(
      { data, error: null, message: null },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err, "loadFailed");
  }
}
