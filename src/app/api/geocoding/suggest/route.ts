import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { matchProvince, matchWard } from "@/lib/vietnam/area-match";
import { suggestAddresses, type AddressSuggestion } from "@/services/geocoding";
import { listProvinces, listWards } from "@/services/geography";

/** The suggestion as the client gets it: the raw area names stay here. */
function publicSuggestion(suggestion: AddressSuggestion) {
  return {
    id: suggestion.id,
    label: suggestion.label,
    latitude: suggestion.latitude,
    longitude: suggestion.longitude,
  };
}

/**
 * Adds our own provinceId/wardId to each suggestion whose ward the geocoder
 * named, so picking it fills the form's Tỉnh/thành and Phường/xã selects
 * (owner, 19/11/2026: picking an address left both empty and the save then
 * refused). `fallbackProvinceId` is the province already chosen in the form,
 * used when the geocoder names a ward but no province. Geography comes from
 * the cached lists, so this costs no query on a warm cache.
 */
async function withAreaIds(
  suggestions: AddressSuggestion[],
  fallbackProvinceId: string | undefined,
) {
  if (!suggestions.some((suggestion) => suggestion.area?.ward)) {
    return suggestions.map(publicSuggestion);
  }
  const provinces = await listProvinces();
  return Promise.all(
    suggestions.map(async (suggestion) => {
      const { area } = suggestion;
      const rest = publicSuggestion(suggestion);
      if (!area?.ward) return rest;
      const province =
        matchProvince(area.province, provinces) ??
        (area.province
          ? null
          : provinces.find((p) => p.id === fallbackProvinceId));
      if (!province) return rest;
      const ward = matchWard(area.ward, await listWards(province.code));
      if (!ward) return rest;
      return {
        ...rest,
        provinceId: province.id,
        wardId: ward.id,
        wardName: ward.name,
        provinceName: province.name,
      };
    }),
  );
}

const suggestQuerySchema = z.object({
  q: z.string().max(200),
  wardId: z.string().min(1).max(64).optional(),
  provinceId: z.string().min(1).max(64).optional(),
});

// Address autocomplete for the profile form. Signed-in only and rate
// limited per user: every call spends MapTiler quota on our key.
export async function GET(request: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    throw err;
  }

  // Rate limiting
  const rateLimit = checkRateLimit(`geocode-suggest:${session.user.id}`, {
    max: 30,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const { searchParams } = new URL(request.url);

  // Validate query parameters
  const parsed = suggestQuerySchema.safeParse({
    q: searchParams.get("q") ?? "",
    // URLSearchParams gives null for a missing key; zod's optional() only
    // accepts undefined.
    wardId: searchParams.get("wardId") || undefined,
    provinceId: searchParams.get("provinceId") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "invalid_query", message: "Invalid query" },
      { status: 400 },
    );
  }

  const { q, wardId, provinceId } = parsed.data;

  let context: { ward?: string; province?: string } = {};
  let contextProvinceId = provinceId;
  if (wardId) {
    const ward = await db.ward.findUnique({
      where: { id: wardId },
      select: {
        name: true,
        provinceId: true,
        province: { select: { name: true } },
      },
    });
    if (ward) {
      contextProvinceId = ward.provinceId;
      context = {
        ward: ward.name,
        province: ward.province?.name,
      };
    }
  } else if (provinceId) {
    const province = await db.province.findUnique({
      where: { id: provinceId },
      select: { name: true },
    });
    if (province) {
      context = {
        province: province.name,
      };
    }
  }

  let result;
  try {
    result = await suggestAddresses(q, context);
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: "Suggestion failed" },
      { status: 500 },
    );
  }

  // Handle response based on result
  if (result.success) {
    // Matching the area is a convenience: if it fails, the suggestions are
    // still good, the selects just stay as the provider left them.
    const suggestions = await withAreaIds(
      result.suggestions,
      contextProvinceId,
    ).catch(() => result.suggestions.map(publicSuggestion));
    return NextResponse.json(
      {
        data: suggestions,
        error: null,
        message: null,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Handle failure cases
  if (result.reason === "not_configured") {
    return NextResponse.json(
      {
        data: null,
        error: "not_configured",
        message: "Address suggestions are not configured",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      data: null,
      error: "upstream_error",
      message: "Address suggestions are unavailable",
    },
    { status: 502 },
  );
}
