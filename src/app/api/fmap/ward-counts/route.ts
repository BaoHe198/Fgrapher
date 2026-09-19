import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  FMAP_PROVIDER_ROLES,
  parseCommaSeparated,
} from "@/lib/validations/fmap";
import { getWardProviderCounts } from "@/services/fmap";

const WARD_COUNTS_RATE_LIMIT = { max: 120, windowMs: 60 * 1000 };

// Per-ward provider counts for the Fmap ward picker, so it only lists wards
// that can actually return someone. Counts ignore availability (that
// depends on the chosen time) — they answer "is anyone based here at all".
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(
    `fmap-ward-counts:${ip}`,
    WARD_COUNTS_RATE_LIMIT,
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
  const roles = parseCommaSeparated(searchParams.get("roles"));
  const parsed = z
    .object({
      provinceId: z.string().min(1).max(64),
      roles: z.array(z.enum(FMAP_PROVIDER_ROLES)).min(1),
    })
    .safeParse({
      provinceId: searchParams.get("provinceId"),
      roles: roles.length > 0 ? roles : [...FMAP_PROVIDER_ROLES],
    });
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "invalid_query", message: "Invalid province" },
      { status: 400 },
    );
  }

  try {
    const counts = await getWardProviderCounts(
      parsed.data.provinceId,
      parsed.data.roles,
    );
    return NextResponse.json(
      { data: counts, error: null, message: null },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: "Ward lookup failed" },
      { status: 500 },
    );
  }
}
