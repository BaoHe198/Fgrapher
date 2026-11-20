import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { isDateKey } from "@/lib/calendar/agenda";
import { icsForAgendaItem } from "@/services/work-calendar";

/**
 * One job from the signed-in provider's calendar as a .ics file — what
 * "Thêm vào lịch điện thoại" downloads. The phone's calendar app opens it
 * and keeps its own copy, alarm included.
 */
export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.calendar");
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const id = searchParams.get("id");
    const date = searchParams.get("date");
    if ((kind !== "BOOKING" && kind !== "ENTRY") || !id || !isDateKey(date)) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidRange") },
        { status: 400 },
      );
    }

    const result = await icsForAgendaItem(session.user.id, kind, id, date);
    if (!result) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("entryNotFound") },
        { status: 404 },
      );
    }

    return new NextResponse(result.ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="fgrapher-${date}.ics"`,
        "Cache-Control": "private, no-store",
      },
    });
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
