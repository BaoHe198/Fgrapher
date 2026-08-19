import { NextResponse } from "next/server";

import { getProductDetail } from "@/services/marketplace";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getProductDetail(id);

  if (!result) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Product not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: result, error: null, message: null }, { status: 200 });
}
