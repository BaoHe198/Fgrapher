import { NextResponse } from "next/server";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getFmapProviderPreview } from "@/services/fmap";

const PREVIEW_RATE_LIMIT = { max: 120, windowMs: 60 * 1000 };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`fmap-preview:${ip}`, PREVIEW_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const { profileId } = await params;
  if (!profileId || profileId.length > 64) {
    return NextResponse.json(
      { data: null, error: "invalid_profile", message: "Invalid provider" },
      { status: 400 },
    );
  }

  try {
    const preview = await getFmapProviderPreview(profileId);
    if (!preview) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Provider not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: preview, error: null, message: null },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: "Preview failed" },
      { status: 500 },
    );
  }
}
