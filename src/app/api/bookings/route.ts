import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { isProviderRoleSet } from "@/services/dashboard";
import { listBookings, type BookingTab } from "@/services/bookings";

const VALID_TABS: BookingTab[] = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get("status")?.toUpperCase() ?? "ALL";
    const tab = VALID_TABS.includes(statusParam as BookingTab)
      ? (statusParam as BookingTab)
      : "ALL";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const result = await listBookings({
      userId: session.user.id,
      isProvider: isProviderRoleSet(session.user.roles),
      tab,
      page,
    });

    return NextResponse.json(
      {
        data: result.bookings,
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
      { data: null, error: "server_error", message: "Failed to load bookings" },
      { status: 500 },
    );
  }
}
