import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { StockAlertError, setStockAlert } from "@/services/stock-alerts";

const bodySchema = z.object({ on: z.boolean() });

// "Báo cho tôi khi có hàng" on a listing: { on: true } asks, { on: false }
// withdraws. Dormant while MARKETPLACE_ENABLED=false.
export async function POST(
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
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Invalid input" },
        { status: 400 },
      );
    }
    const { id } = await params;
    const data = await setStockAlert(session.user.id, id, parsed.data.on);
    return NextResponse.json({ data, error: null, message: null });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof StockAlertError) {
      return NextResponse.json(
        { data: null, error: "stock_alert_error", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
