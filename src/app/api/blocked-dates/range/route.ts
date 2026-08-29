import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { blockDateRangeSchema } from "@/lib/validations/availability";
import { findConfirmedBookingConflicts } from "@/services/availability";

const MAX_RANGE_DAYS = 90;

function* datesInRange(from: Date, to: Date) {
  for (
    let d = new Date(from);
    d.getTime() <= to.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    yield new Date(d);
  }
}

// Prompt F3, VIỆC 2's "Chặn nhiều ngày" option — always whole-day blocks
// (a time-range only makes sense for a single day, handled by the plain
// POST /api/blocked-dates instead). All-or-nothing: if ANY date in the
// range has a CONFIRMED booking, nothing is blocked, so the provider isn't
// left with a confusing partially-applied range.
export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.blockedDates");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = blockDateRangeSchema.safeParse(body);
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

    const from = new Date(`${parsed.data.fromDate}T00:00:00.000Z`);
    const to = new Date(`${parsed.data.toDate}T00:00:00.000Z`);
    if (to < from) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidRange") },
        { status: 400 },
      );
    }
    const dayCount =
      Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (dayCount > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("rangeTooLong") },
        { status: 400 },
      );
    }

    const dates = Array.from(datesInRange(from, to));
    const conflictChecks = await Promise.all(
      dates.map((date) => findConfirmedBookingConflicts(session.user.id, date)),
    );
    if (conflictChecks.some((c) => c.length > 0)) {
      return NextResponse.json(
        { data: null, error: "conflict", message: t("conflict") },
        { status: 409 },
      );
    }

    await db.$transaction(
      dates.map((date) =>
        db.blockedDate.upsert({
          where: { userId_date: { userId: session.user.id, date } },
          create: {
            userId: session.user.id,
            date,
            reason: parsed.data.reason,
          },
          update: {
            reason: parsed.data.reason,
            startTime: null,
            endTime: null,
          },
        }),
      ),
    );

    return NextResponse.json(
      { data: { count: dates.length }, error: null, message: t("blocked") },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: t("blockFailed") },
      { status: 500 },
    );
  }
}
