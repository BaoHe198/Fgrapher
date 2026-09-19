import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getProvinceProviderBounds } from "@/services/fmap";

const PROVINCE_BOUNDS_RATE_LIMIT = { max: 120, windowMs: 60 * 1000 };

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
  const parsed = z
    .object({
      provinceId: z.string().min(1).max(64),
      wardId: z.string().min(1).max(64).optional(),
    })
    .safeParse({
      provinceId: searchParams.get("provinceId"),
      wardId: searchParams.get("wardId") || undefined,
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
