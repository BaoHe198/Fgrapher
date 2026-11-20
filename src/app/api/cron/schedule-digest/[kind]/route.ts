import { NextResponse } from "next/server";

import { AuthError, requireCronSecret } from "@/lib/auth-helpers";
import { sendScheduleDigests } from "@/services/work-calendar";

/**
 * /api/cron/schedule-digest/evening — "tomorrow you have…", around 20:00
 * /api/cron/schedule-digest/morning — "today you have…", around 06:30
 * (Vietnam time; see vercel.json). Safe to run twice for the same day.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
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

  const { kind } = await params;
  if (kind !== "evening" && kind !== "morning") {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Unknown digest" },
      { status: 404 },
    );
  }

  const providersNotified = await sendScheduleDigests(kind);
  return NextResponse.json(
    { data: { kind, providersNotified }, error: null, message: null },
    { status: 200 },
  );
}
