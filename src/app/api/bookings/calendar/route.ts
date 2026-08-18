import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { listBookingsForRange } from "@/services/bookings";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    // "month" is a "YYYY-MM" key anchored to UTC, matching the rest of the
    // app's UTC-anchored calendar-date convention.
    const monthParam = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const from = new Date(`${monthParam}-01T00:00:00.000Z`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);

    const bookings = await listBookingsForRange({
      providerId: session.user.id,
      from,
      to,
    });

    return NextResponse.json({ data: bookings, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load calendar" },
      { status: 500 },
    );
  }
}
