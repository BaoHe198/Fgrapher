import type { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { listOrders } from "@/services/orders";

const VALID_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.orders");
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: t("notFound") },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const role = searchParams.get("role") === "shop" ? "shop" : "customer";
    const statusParam = searchParams.get("status")?.toUpperCase();
    const status = VALID_STATUSES.includes(statusParam as OrderStatus)
      ? (statusParam as OrderStatus)
      : undefined;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const result = await listOrders({
      userId: session.user.id,
      role,
      status,
      page,
    });

    return NextResponse.json(
      {
        data: result.orders,
        error: null,
        message: null,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
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
      { data: null, error: "server_error", message: t("listLoadFailed") },
      { status: 500 },
    );
  }
}
