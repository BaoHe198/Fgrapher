import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { updateCartItemSchema } from "@/lib/validations/marketplace";
import {
  CartError,
  removeCartItem,
  updateCartItemQuantity,
} from "@/services/marketplace";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.cart");
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: t("notFound") },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCartItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: t("invalidQuantity"),
        },
        { status: 400 },
      );
    }

    const item = await updateCartItemQuantity(
      id,
      session.user.id,
      parsed.data.quantity,
    );

    return NextResponse.json(
      { data: item, error: null, message: null },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof CartError) {
      return NextResponse.json(
        { data: null, error: "cart_error", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: t("updateFailed"),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.cart");
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: t("notFound") },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { id } = await params;

    await removeCartItem(id, session.user.id);

    return NextResponse.json(
      { data: null, error: null, message: t("removed") },
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
        message: t("removeFailed"),
      },
      { status: 500 },
    );
  }
}
