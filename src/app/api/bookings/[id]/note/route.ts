import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { bookingNoteSchema } from "@/lib/validations/calendar";
import { BookingNoteError, saveBookingNote } from "@/services/work-calendar";

/**
 * The caller's own private note on a booking they are part of. An empty
 * note removes it. Never returned to, or visible to, the other side.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.calendar");
  try {
    const session = await requireAuth();
    const { id } = await params;
    const parsed = bookingNoteSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("noteTooLong") },
        { status: 400 },
      );
    }

    const note = await saveBookingNote(id, session.user.id, parsed.data.note);
    return NextResponse.json(
      { data: { note }, error: null, message: t("noteSaved") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof BookingNoteError) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("bookingNotFound") },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("noteFailed") },
      { status: 500 },
    );
  }
}
