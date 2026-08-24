import { NextResponse } from "next/server";

import { listProvinces } from "@/services/geography";

// Public, unauthenticated — same reasoning as /api/geography/wards. Backs
// the browse-filter city dropdown, which used to be a hardcoded 8-city
// list (CLAUDE.md mục 9 forbids that); today this returns exactly one row
// (Thành phố Hồ Chí Minh) until more provinces' real ward data is seeded.
export async function GET() {
  const provinces = await listProvinces();

  return NextResponse.json(
    { data: provinces, error: null, message: null },
    { status: 200 },
  );
}
