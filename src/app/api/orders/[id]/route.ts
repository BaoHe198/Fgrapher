import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { getOrderDetail } from "@/services/orders";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const order = await getOrderDetail(id, session.user.id);
    if (!order) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Order not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: order, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load order" },
      { status: 500 },
    );
  }
}
