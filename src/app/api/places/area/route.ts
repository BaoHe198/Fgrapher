import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth-helpers";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { checkRateLimit } from "@/lib/rate-limit";
import { placeNearbySchema } from "@/lib/validations/place";
import { matchProvince, matchWard } from "@/lib/vietnam/area-match";
import { listProvinces, listWards } from "@/services/geography";
import { reverseGeocodeArea } from "@/services/geocoding";
import { canProposePlaces, PlaceError } from "@/services/places";

const AREA_RATE_LIMIT = { max: 30, windowMs: 60 * 1000 };

/**
 * The province and ward under a map pin, as our own rows — the proposal
 * form fills its two selects from it and warns when they disagree. A miss
 * (no geocoder, no unique match) answers with nulls, never an error the
 * form has to show: choosing by hand still works.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    if (!(await canProposePlaces(session.user.id))) {
      throw new PlaceError("not_allowed", 403);
    }
    const limit = checkRateLimit(
      `place-area:${session.user.id}`,
      AREA_RATE_LIMIT,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        {
          data: { provinceId: null, wardId: null },
          error: "too_many_requests",
          message: null,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }
    const url = new URL(request.url);
    const parsed = placeNearbySchema.safeParse({
      latitude: url.searchParams.get("lat"),
      longitude: url.searchParams.get("lng"),
    });
    if (!parsed.success) return placeInvalid(parsed.error);

    const found = await reverseGeocodeArea(parsed.data);
    if (!found.success) {
      return NextResponse.json(
        {
          data: { provinceId: null, wardId: null },
          error: null,
          message: null,
        },
        { status: 200 },
      );
    }
    const province = matchProvince(found.province, await listProvinces());
    const ward = province
      ? matchWard(found.ward, await listWards(province.code))
      : null;
    return NextResponse.json(
      {
        data: { provinceId: province?.id ?? null, wardId: ward?.id ?? null },
        error: null,
        message: null,
      },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err, "loadFailed");
  }
}
