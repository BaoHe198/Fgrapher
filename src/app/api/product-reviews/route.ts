import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { createProductReviewSchema } from "@/lib/validations/product-review";
import {
  createProductReview,
  listProductReviews,
  ProductReviewError,
} from "@/services/product-reviews";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
function marketplaceOff() {
  return NextResponse.json(
    { data: null, error: "not_found", message: "Not found" },
    { status: 404 },
  );
}

export async function GET(request: Request) {
  if (!features.marketplaceEnabled) return marketplaceOff();

  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId) {
    return NextResponse.json(
      {
        data: null,
        error: "validation_error",
        message: "productId required",
      },
      { status: 400 },
    );
  }

  const reviews = await listProductReviews(productId);
  return NextResponse.json(
    { data: reviews, error: null, message: null },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  if (!features.marketplaceEnabled) return marketplaceOff();

  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = createProductReviewSchema.safeParse(body);
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

    const review = await createProductReview({
      ...parsed.data,
      reviewerId: session.user.id,
    });

    return NextResponse.json(
      { data: review, error: null, message: "Review posted" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof ProductReviewError) {
      return NextResponse.json(
        { data: null, error: "review_error", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to post review" },
      { status: 500 },
    );
  }
}
