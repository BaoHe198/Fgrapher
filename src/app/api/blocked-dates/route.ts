import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createBlockedDateSchema } from "@/lib/validations/availability";
import {
  findConfirmedBookingConflicts,
  listBlockedDates,
} from "@/services/availability";

export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.blockedDates");
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    const blockedDates = await listBlockedDates(
      session.user.id,
      new Date(from),
      new Date(to),
    );

    return NextResponse.json(
      { data: blockedDates, error: null, message: null },
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
      { data: null, error: "server_error", message: t("listFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.blockedDates");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createBlockedDateSchema.safeParse(body);
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

    const date = new Date(parsed.data.date);
    const conflicts = await findConfirmedBookingConflicts(
      session.user.id,
      date,
      parsed.data.startTime,
      parsed.data.endTime,
    );
    if (conflicts.length > 0) {
      return NextResponse.json(
        { data: null, error: "conflict", message: t("conflict") },
        { status: 409 },
      );
    }

    // Explicit null (not undefined) so re-blocking a previously
    // time-ranged date as a whole day actually clears the old range —
    // Prisma's update skips undefined fields entirely rather than nulling
    // them.
    const blockedDate = await db.blockedDate.upsert({
      where: { userId_date: { userId: session.user.id, date } },
      create: {
        userId: session.user.id,
        date,
        reason: parsed.data.reason,
        startTime: parsed.data.startTime ?? null,
        endTime: parsed.data.endTime ?? null,
      },
      update: {
        reason: parsed.data.reason,
        startTime: parsed.data.startTime ?? null,
        endTime: parsed.data.endTime ?? null,
      },
    });

    return NextResponse.json(
      { data: blockedDate, error: null, message: t("blocked") },
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
