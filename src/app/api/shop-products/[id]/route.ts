import { NextResponse } from "next/server";

import { features } from "@/lib/features";
import { getProductDetail } from "@/services/marketplace";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  const { id } = await params;
  const result = await getProductDetail(id);

  if (!result) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Product not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { data: result, error: null, message: null },
    { status: 200 },
  );
}
