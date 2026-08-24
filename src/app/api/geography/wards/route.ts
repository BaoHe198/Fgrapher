import { NextResponse } from "next/server";

import { listWards } from "@/services/geography";

// Public, unauthenticated — the registration form needs this before login,
// and it's the same non-sensitive reference data /browse's city filter
// already exposes indirectly. No pagination: 168 rows (HCMC only) today.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provinceCode = searchParams.get("provinceCode") ?? undefined;

  const wards = await listWards(provinceCode);

  return NextResponse.json(
    { data: wards, error: null, message: null },
    { status: 200 },
  );
}
