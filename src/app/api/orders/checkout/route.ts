import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { StripeNotConfiguredError } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validations/marketplace";
import { createCheckoutSessionForCart, OrderError } from "@/services/orders";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "deliveryMethod is required" },
        { status: 400 },
      );
    }

    const checkoutSession = await createCheckoutSessionForCart(
      session.user.id,
      parsed.data.deliveryMethod,
    );

    return NextResponse.json(
      { data: { url: checkoutSession.url }, error: null, message: null },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof OrderError) {
      return NextResponse.json(
        { data: null, error: "order_error", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json(
        { data: null, error: "not_configured", message: err.message },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to start checkout" },
      { status: 500 },
    );
  }
}
