import { NextResponse } from "next/server";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { quickSearch } from "@/services/quick-search";

// Backs the ⌘K palette. Public like /api/search; the palette waits 150ms
// after typing stops, so a person produces a few calls a second at most.
const QUICK_SEARCH_RATE_LIMIT = { max: 240, windowMs: 60 * 1000 };

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(
    `search-quick:${ip}`,
    QUICK_SEARCH_RATE_LIMIT,
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

  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  try {
    const data = await quickSearch(q);
    return NextResponse.json(
      { data, error: null, message: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "search_failed", message: "Search failed" },
      { status: 500 },
    );
  }
}
