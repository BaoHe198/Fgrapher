import { NextResponse } from "next/server";

import { AuthError, requireCronSecret } from "@/lib/auth-helpers";
import { sendBookingReminders } from "@/services/bookings";

export async function GET(request: Request) {
  try {
    requireCronSecret(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    throw err;
  }

  const remindersSent = await sendBookingReminders();

  return NextResponse.json(
    { data: { remindersSent }, error: null, message: null },
    { status: 200 },
  );
}
