import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import {
  BookingActionError,
  getBookingDetail,
  transitionBooking,
} from "@/services/bookings";
import { updateBookingStatusSchema } from "@/lib/validations/booking";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const booking = await getBookingDetail(id, session.user.id);
    if (!booking) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Booking not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: booking, error: null, message: null },
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
      { data: null, error: "server_error", message: "Failed to load booking" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateBookingStatusSchema.safeParse(body);
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

    const booking = await transitionBooking({
      bookingId: id,
      toStatus: parsed.data.status,
      actorId: session.user.id,
      note: parsed.data.cancelReason,
    });

    return NextResponse.json(
      { data: booking, error: null, message: "Booking updated" },
      { status: 200 },
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
      {
        data: null,
        error: "server_error",
        message: "Failed to update booking",
      },
      { status: 500 },
    );
  }
}
