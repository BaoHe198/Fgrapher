import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  AuthError,
  requireActiveSubscription,
  requireAuth,
} from "@/lib/auth-helpers";
import { SELLER_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";
import { UploadVerificationError } from "@/lib/cloudinary";
import {
  productCategoryAllowedForRole,
  getProductSchema,
} from "@/lib/validations/product";
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
    if (err instanceof UploadVerificationError) {
      return NextResponse.json(
        {
          data: null,
          error: "invalid_upload",
          message: "Uploaded product images could not be verified",
        },
        { status: 400 },
      );
    }

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
    // Product-capable roles publish inventory. Buying remains available to
    // every authenticated account through the cart and messaging flows.
    const sellerRole = SELLER_ROLES.find((role) =>
      session.user.roles.includes(role),
    );
    if (!sellerRole) {
      return NextResponse.json(
        {
          data: null,
          error: "forbidden",
          message: "This role cannot publish products on Chợ F",
        },
        { status: 403 },
      );
    }
    await requireActiveSubscription(session.user.id, sellerRole);

    const body = await request.json();
    const parsed = getProductSchema(
      await getTranslations("libServices.validation.product"),
    ).safeParse(body);
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
    if (!productCategoryAllowedForRole(sellerRole, parsed.data.category)) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: "This category is not available for your shop role",
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
