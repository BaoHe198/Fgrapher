import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { StripeNotConfiguredError } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validations/marketplace";
import { createCheckoutSessionForCart, OrderError } from "@/services/orders";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.orders");
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: t("notFound") },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: t("deliveryMethodRequired"),
        },
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
      {
        data: null,
        error: "server_error",
        message: t("checkoutFailed"),
      },
      { status: 500 },
    );
  }
}
