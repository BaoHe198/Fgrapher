import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import {
  proposeRescheduleSchema,
  respondRescheduleSchema,
} from "@/lib/validations/booking";
import {
  BookingActionError,
  proposeReschedule,
  respondToReschedule,
} from "@/services/bookings";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.bookings");
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
          message: parsed.error.issues[0]?.message ?? t("invalidInput"),
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
      { data: booking, error: null, message: t("rescheduleProposed") },
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
        message: t("rescheduleProposeFailed"),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.bookings");
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
          message: parsed.error.issues[0]?.message ?? t("invalidInput"),
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
      {
        data: booking,
        error: null,
        message: parsed.data.accept
          ? t("rescheduleAccepted")
          : t("rescheduleDeclined"),
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
        message: t("rescheduleRespondFailed"),
      },
      { status: 500 },
    );
  }
}
