import { NextResponse } from "next/server";

import { expireBookings } from "@/services/bookings";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: null },
      { status: 401 },
    );
  }

  const expiredCount = await expireBookings();

  return NextResponse.json(
    { data: { expiredCount }, error: null, message: null },
    { status: 200 },
  );
}
