import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { duplicateProduct } from "@/services/products";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { id } = await params;

    const product = await duplicateProduct(id, session.user.id);
    if (!product) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Product not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: product, error: null, message: "Product duplicated" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: "Failed to duplicate product",
      },
      { status: 500 },
    );
  }
}
