import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { respondSchema } from "@/lib/validations/review";
import { respondToReview, ReviewError, updateReviewResponse } from "@/services/reviews";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "A response is required" },
        { status: 400 },
      );
    }

    const review = await respondToReview({
      reviewId: id,
      providerId: session.user.id,
      response: parsed.data.response,
    });

    return NextResponse.json(
      { data: review, error: null, message: "Response posted" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof ReviewError) {
      return NextResponse.json(
        { data: null, error: "review_error", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to post response" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "A response is required" },
        { status: 400 },
      );
    }

    const review = await updateReviewResponse({
      reviewId: id,
      providerId: session.user.id,
      response: parsed.data.response,
    });

    return NextResponse.json(
      { data: review, error: null, message: "Response updated" },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof ReviewError) {
      return NextResponse.json(
        { data: null, error: "review_error", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to update response" },
      { status: 500 },
    );
  }
}
