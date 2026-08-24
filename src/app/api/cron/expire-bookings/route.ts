import { NextResponse } from "next/server";

import { AuthError, requireCronSecret } from "@/lib/auth-helpers";
import { expireBookings } from "@/services/bookings";

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

  const expiredCount = await expireBookings();

  return NextResponse.json(
    { data: { expiredCount }, error: null, message: null },
    { status: 200 },
  );
}
