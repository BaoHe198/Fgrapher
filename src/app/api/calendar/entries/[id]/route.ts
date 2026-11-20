import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { calendarEntrySchema } from "@/lib/validations/calendar";
import {
  CalendarEntryError,
  deleteCalendarEntry,
  updateCalendarEntry,
} from "@/services/calendar-entries";

import { entryIssueMessage } from "../messages";

type Params = { params: Promise<{ id: string }> };

function failure(
  err: unknown,
  t: (key: string) => string,
  fallbackKey: string,
) {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { data: null, error: "unauthorized", message: err.message },
      { status: err.status },
    );
  }
  if (err instanceof CalendarEntryError) {
    return NextResponse.json(
      {
        data: null,
        error: err.code,
        message: t(err.code === "not_found" ? "entryNotFound" : "providerOnly"),
      },
      { status: err.status },
    );
  }
  return NextResponse.json(
    { data: null, error: "server_error", message: t(fallbackKey) },
    { status: 500 },
  );
}

/** Replaces one of the signed-in provider's own entries. */
export async function PATCH(request: Request, { params }: Params) {
  const t = await getTranslations("apiMessages.calendar");
  try {
    const session = await requireAuth();
    const { id } = await params;
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

    await updateCalendarEntry(id, session.user.id, parsed.data);
    return NextResponse.json(
      { data: { id }, error: null, message: t("entrySaved") },
      { status: 200 },
    );
  } catch (err) {
    return failure(err, t, "saveFailed");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const t = await getTranslations("apiMessages.calendar");
  try {
    const session = await requireAuth();
    const { id } = await params;
    await deleteCalendarEntry(id, session.user.id);
    return NextResponse.json(
      { data: null, error: null, message: t("entryDeleted") },
      { status: 200 },
    );
  } catch (err) {
    return failure(err, t, "deleteFailed");
  }
}
