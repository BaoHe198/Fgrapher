import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAnyRole, requireAuth } from "@/lib/auth-helpers";
import { PROVIDER_ROLES } from "@/lib/constants";
import { calendarRangeSchema } from "@/lib/validations/calendar";
import { getWorkAgenda } from "@/services/work-calendar";

/**
 * The signed-in provider's working days from `from` up to (not including)
 * `to`, both "yyyy-MM-dd" in Vietnam time: bookings, their own entries and
 * busy blocks as one sorted list.
 */
export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.calendar");
  try {
    const session = await requireAuth();
    requireAnyRole(session, PROVIDER_ROLES);

    const { searchParams } = new URL(request.url);
    const parsed = calendarRangeSchema.safeParse({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidRange") },
        { status: 400 },
      );
    }

    const items = await getWorkAgenda(
      session.user.id,
      parsed.data.from,
      parsed.data.to,
    );
    return NextResponse.json(
      { data: { items }, error: null, message: null },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: t("providerOnly") },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}
