import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { createBookingSchema } from "@/lib/validations/booking";
import { isProviderRoleSet } from "@/services/dashboard";
import {
  BookingActionError,
  createBooking,
  listBookings,
  type BookingTab,
} from "@/services/bookings";

const VALID_TABS: BookingTab[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.bookings");
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
      { data: null, error: "server_error", message: t("listLoadFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.bookings");
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? t("invalidInput"),
        },
        { status: 400 },
      );
    }

    const booking = await createBooking(session.user.id, parsed.data);

    return NextResponse.json(
      { data: booking, error: null, message: t("requestSent") },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof BookingActionError) {
      return NextResponse.json(
        { data: null, error: "booking_error", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: t("createFailed") },
      { status: 500 },
    );
  }
}
