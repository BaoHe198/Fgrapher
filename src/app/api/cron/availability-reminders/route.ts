import { NextResponse } from "next/server";

import { AuthError, requireCronSecret } from "@/lib/auth-helpers";
import { sendAvailabilityUpdateReminders } from "@/services/availability-reminders";

export async function GET(request: Request) {
  try {
    requireCronSecret(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: error.message },
        { status: error.status },
      );
    }
    throw error;
  }

  const remindersSent = await sendAvailabilityUpdateReminders();

  return NextResponse.json(
    { data: { remindersSent }, error: null, message: null },
    { status: 200 },
  );
}
