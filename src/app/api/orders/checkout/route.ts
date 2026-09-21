import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { checkoutSchema } from "@/lib/validations/marketplace";
import { OrderError, placeOrdersFromCart } from "@/services/orders";

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

    const orders = await placeOrdersFromCart(session.user.id, {
      deliveryMethod: parsed.data.deliveryMethod,
      shippingAddress: parsed.data.shippingAddress,
    });

    return NextResponse.json(
      {
        data: { orderIds: orders.map((order) => order.id) },
        error: null,
        message: null,
      },
      { status: 201 },
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
