import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { getOrderDetail } from "@/services/orders";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.orders");
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: t("notFound") },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { id } = await params;

    const order = await getOrderDetail(id, session.user.id);
    if (!order) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("orderNotFound") },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: order, error: null, message: null },
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
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}
