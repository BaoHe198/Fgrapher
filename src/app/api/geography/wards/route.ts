import { NextResponse } from "next/server";

import { GEOGRAPHY_CACHE_CONTROL } from "@/lib/cache";
import { listWards } from "@/services/geography";

// Public, unauthenticated — the registration form needs this before login,
// and it's the same non-sensitive reference data /browse exposes. The client
// always scopes by province, so no response needs to carry all 3,321 rows.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provinceCode = searchParams.get("provinceCode") ?? undefined;

  const wards = await listWards(provinceCode);

  return NextResponse.json(
    { data: wards, error: null, message: null },
    { status: 200, headers: { "Cache-Control": GEOGRAPHY_CACHE_CONTROL } },
  );
}
