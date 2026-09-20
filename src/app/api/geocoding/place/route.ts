import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveSuggestion } from "@/services/geocoding";

const PLACE_RATE_LIMIT = { max: 30, windowMs: 60 * 1000 };

// Coordinates for one address suggestion. Goong's autocomplete returns
// place ids only, so the form calls this once the provider picks a line.
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

  const rateLimit = checkRateLimit(
    `geocode-place:${session.user.id}`,
    PLACE_RATE_LIMIT,
  );
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
  const parsed = z
    .object({ id: z.string().min(1).max(200) })
    .safeParse({ id: searchParams.get("id") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "invalid_query", message: "Invalid place" },
      { status: 400 },
    );
  }

  try {
    const result = await resolveSuggestion(parsed.data.id);
    if (!result.success) {
      return NextResponse.json(
        {
          data: null,
          error: result.reason,
          message: "Could not locate that address",
        },
        { status: result.reason === "not_configured" ? 503 : 502 },
      );
    }
    return NextResponse.json(
      {
        data: { latitude: result.latitude, longitude: result.longitude },
        error: null,
        message: null,
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: "Lookup failed" },
      { status: 500 },
    );
  }
}
