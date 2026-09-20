import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  FMAP_PROVIDER_ROLES,
  fmapSearchSchema,
  parseCommaSeparated,
} from "@/lib/validations/fmap";
import { findAvailableProvidersOnMap } from "@/services/fmap";

const FMAP_RATE_LIMIT = { max: 60, windowMs: 60 * 1000 };

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`fmap:${ip}`, FMAP_RATE_LIMIT);
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
  const roles = parseCommaSeparated(searchParams.get("roles"));
  const parsed = fmapSearchSchema.safeParse({
    north: searchParams.get("north"),
    south: searchParams.get("south"),
    east: searchParams.get("east"),
    west: searchParams.get("west"),
    date: searchParams.get("date"),
    start: searchParams.get("start"),
    end: searchParams.get("end"),
    roles: roles.length > 0 ? roles : [...FMAP_PROVIDER_ROLES],
    categories: parseCommaSeparated(searchParams.get("categories")),
    wardId: searchParams.get("wardId") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "invalid_query",
        message: "Invalid map search filters",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const session = await auth();
    const result = await findAvailableProvidersOnMap(
      parsed.data,
      session?.user?.id,
    );

    return NextResponse.json(
      {
        data: result.markers,
        truncated: result.truncated,
        error: null,
        message: null,
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: "Map search failed" },
      { status: 500 },
    );
  }
}
