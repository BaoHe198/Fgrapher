import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { proposeRescheduleSchema, respondRescheduleSchema } from "@/lib/validations/booking";
import { BookingActionError, proposeReschedule, respondToReschedule } from "@/services/bookings";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = proposeRescheduleSchema.safeParse(body);
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

    const booking = await proposeReschedule({
      bookingId: id,
      userId: session.user.id,
      ...parsed.data,
    });

    return NextResponse.json(
      { data: booking, error: null, message: "Reschedule proposed" },
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
      { data: null, error: "server_error", message: "Failed to propose reschedule" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = respondRescheduleSchema.safeParse(body);
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

    const booking = await respondToReschedule({
      bookingId: id,
      userId: session.user.id,
      accept: parsed.data.accept,
    });

    return NextResponse.json(
      { data: booking, error: null, message: parsed.data.accept ? "Reschedule accepted" : "Reschedule declined" },
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
      { data: null, error: "server_error", message: "Failed to respond to reschedule" },
      { status: 500 },
    );
  }
}
