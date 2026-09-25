import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  FMAP_PROVIDER_ROLES,
  parseCommaSeparated,
} from "@/lib/validations/fmap";
import { getProvinceProviderBounds } from "@/services/fmap";

// Per IP, and Vietnamese mobile carriers put many subscribers behind one
// shared address (CGNAT), as do venue and office wifi: this is a ceiling
// against scripted abuse, set high enough not to lock out real people who
// happen to share an IP. Tight per-person limits live on the email/account.
const PROVINCE_BOUNDS_RATE_LIMIT = { max: 300, windowMs: 60 * 1000 };

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(
    `fmap-province:${ip}`,
    PROVINCE_BOUNDS_RATE_LIMIT,
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
  const rolesParam = parseCommaSeparated(searchParams.get("roles"));
  const parsed = z
    .object({
      provinceId: z.string().min(1).max(64),
      wardId: z.string().min(1).max(64).optional(),
      roles: z.array(z.enum(FMAP_PROVIDER_ROLES)).min(1),
    })
    .safeParse({
      provinceId: searchParams.get("provinceId"),
      wardId: searchParams.get("wardId") || undefined,
      roles: rolesParam.length > 0 ? rolesParam : [...FMAP_PROVIDER_ROLES],
    });
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "invalid_query", message: "Invalid province" },
      { status: 400 },
    );
  }

  try {
    const bounds = await getProvinceProviderBounds(
      parsed.data.provinceId,
      parsed.data.wardId,
      parsed.data.roles,
    );
    return NextResponse.json(
      { data: bounds, error: null, message: null },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: "Province lookup failed" },
      { status: 500 },
    );
  }
}
