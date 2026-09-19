import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { suggestAddresses } from "@/services/geocoding";

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
  if (wardId) {
    const ward = await db.ward.findUnique({
      where: { id: wardId },
      select: { name: true, province: { select: { name: true } } },
    });
    if (ward) {
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
    return NextResponse.json(
      {
        data: result.suggestions,
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
