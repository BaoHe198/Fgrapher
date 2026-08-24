import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { weeklyAvailabilitySchema } from "@/lib/validations/availability";

export async function GET() {
  const t = await getTranslations("apiMessages.availability");
  try {
    const session = await requireAuth();

    const [schedule, blockedDates] = await Promise.all([
      db.availability.findMany({
        where: { userId: session.user.id },
        orderBy: { dayOfWeek: "asc" },
      }),
      db.blockedDate.findMany({
        where: { userId: session.user.id, date: { gte: new Date() } },
        orderBy: { date: "asc" },
      }),
    ]);

    return NextResponse.json(
      { data: { schedule, blockedDates }, error: null, message: null },
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
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const t = await getTranslations("apiMessages.availability");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = weeklyAvailabilitySchema.safeParse(body);
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

    await db.$transaction([
      db.availability.deleteMany({ where: { userId: session.user.id } }),
      db.availability.createMany({
        data: parsed.data.schedule
          .filter((day) => day.isActive)
          .map((day) => ({
            userId: session.user.id,
            dayOfWeek: day.dayOfWeek,
            startTime: day.startTime,
            endTime: day.endTime,
            isActive: true,
          })),
      }),
    ]);

    return NextResponse.json(
      { data: null, error: null, message: t("updated") },
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
      { data: null, error: "server_error", message: t("updateFailed") },
      { status: 500 },
    );
  }
}
