import { NextResponse } from "next/server";

import {
  AuthError,
  requireActiveSubscription,
  requireAuth,
} from "@/lib/auth-helpers";
import { SELLER_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";
import { productSchema } from "@/lib/validations/product";
import {
  createProduct,
  listProducts,
  type ListingFilter,
} from "@/services/products";

const VALID_FILTERS: ListingFilter[] = ["ALL", "SALE", "RENT", "OUT_OF_STOCK"];

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function GET(request: Request) {
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const filterParam = searchParams.get("type")?.toUpperCase() ?? "ALL";
    const filter = VALID_FILTERS.includes(filterParam as ListingFilter)
      ? (filterParam as ListingFilter)
      : "ALL";

    const products = await listProducts({ userId: session.user.id, filter });

    return NextResponse.json(
      { data: products, error: null, message: null },
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
      { data: null, error: "server_error", message: "Failed to load products" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    // Either shop role may list; whichever one this account holds must have
    // an active subscription.
    const sellerRole = SELLER_ROLES.find((role) =>
      session.user.roles.includes(role),
    );
    if (!sellerRole) {
      return NextResponse.json(
        {
          data: null,
          error: "forbidden",
          message:
            "Chợ F lists photo and video equipment — only a camera shop, photographer, videographer or studio can list here",
        },
        { status: 403 },
      );
    }
    await requireActiveSubscription(session.user.id, sellerRole);

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

    const product = await createProduct(session.user.id, parsed.data);

    return NextResponse.json(
      { data: product, error: null, message: "Product created" },
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
        message: "Failed to create product",
      },
      { status: 500 },
    );
  }
}
