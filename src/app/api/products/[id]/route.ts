import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { productSchema } from "@/lib/validations/product";
import { deleteProduct, updateProduct } from "@/services/products";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    include: { images: { orderBy: { order: "asc" } } },
  });

  if (!product || product.deletedAt) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Product not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { data: product, error: null, message: null },
    { status: 200 },
  );
}

export async function PATCH(
  request: Request,
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

    const body = await request.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }

    const product = await updateProduct(id, session.user.id, parsed.data);
    if (!product) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Product not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: product, error: null, message: "Product updated" },
      { status: 200 },
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
        message: "Failed to update product",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const ok = await deleteProduct(id, session.user.id);
    if (!ok) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Product not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: null, error: null, message: "Product deleted" },
      { status: 200 },
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
        message: "Failed to delete product",
      },
      { status: 500 },
    );
  }
}
