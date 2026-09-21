import { NextResponse } from "next/server";

import { AuthError, requireCronSecret } from "@/lib/auth-helpers";
import { sendRentalReturnReminders } from "@/services/orders";

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

  const remindedCount = await sendRentalReturnReminders();

  return NextResponse.json(
    { data: { remindedCount }, error: null, message: null },
    { status: 200 },
  );
}
