import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { PROVIDER_ROLES } from "@/lib/constants";
import {
  listBlocks,
  listWeeklyRules,
  replaceWeeklyRules,
} from "@/services/resource-calendar";
import { weeklyAvailabilitySchema } from "@/lib/validations/availability";
import { vietnamDateStart } from "@/lib/vietnam-date";

export async function GET() {
  const t = await getTranslations("apiMessages.availability");
  try {
    const session = await requireAuth();
    if (!session.user.roles.some((role) => PROVIDER_ROLES.includes(role))) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: t("loadFailed") },
        { status: 403 },
      );
    }

    const from = vietnamDateStart();
    // A year ahead: the editor shows upcoming blocks, and there is no point
    // sending a provider blocks they set for two years' time.
    const to = new Date(from.getTime() + 365 * 24 * 3_600_000);
    const [schedule, blockedDates] = await Promise.all([
      listWeeklyRules(session.user.id),
      listBlocks(session.user.id, from, to),
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
    if (!session.user.roles.some((role) => PROVIDER_ROLES.includes(role))) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: t("updateFailed") },
        { status: 403 },
      );
    }

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

    await replaceWeeklyRules(
      session.user.id,
      parsed.data.schedule
        .filter((day) => day.isActive)
        .map((day) => ({
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
        })),
    );

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
