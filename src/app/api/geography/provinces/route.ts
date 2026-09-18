import { NextResponse } from "next/server";

import { GEOGRAPHY_CACHE_CONTROL } from "@/lib/cache";
import { listProvinces } from "@/services/geography";

// Public, unauthenticated — same reasoning as /api/geography/wards. Backs
// the browse-filter province dropdown from the nationwide reference tables.
export async function GET() {
  const provinces = await listProvinces();

  return NextResponse.json(
    { data: provinces, error: null, message: null },
    { status: 200, headers: { "Cache-Control": GEOGRAPHY_CACHE_CONTROL } },
  );
}
