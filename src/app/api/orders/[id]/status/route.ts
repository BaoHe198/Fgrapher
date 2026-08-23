import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { updateOrderStatusSchema } from "@/lib/validations/marketplace";
import { OrderError, updateOrderStatus } from "@/services/orders";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateOrderStatusSchema.safeParse(body);
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

    const order = await updateOrderStatus({
      orderId: id,
      userId: session.user.id,
      ...parsed.data,
    });

    return NextResponse.json(
      { data: order, error: null, message: "Order updated" },
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

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to update order" },
      { status: 500 },
    );
  }
}
