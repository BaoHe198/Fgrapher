import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { calendarEntrySchema } from "@/lib/validations/calendar";
import {
  CalendarEntryError,
  createCalendarEntry,
} from "@/services/calendar-entries";

import { entryIssueMessage } from "./messages";

/** Adds a job to the signed-in provider's own calendar. */
export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.calendar");
  try {
    const session = await requireAuth();
    const parsed = calendarEntrySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: entryIssueMessage(t, parsed.error.issues[0]?.message),
        },
        { status: 400 },
      );
    }

    const entry = await createCalendarEntry(session.user.id, parsed.data);
    return NextResponse.json(
      { data: { id: entry.id }, error: null, message: t("entrySaved") },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof CalendarEntryError) {
      return NextResponse.json(
        { data: null, error: err.code, message: t("providerOnly") },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("saveFailed") },
      { status: 500 },
    );
  }
}
