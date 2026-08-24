import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { markAllNotificationsRead } from "@/services/notification";

export async function POST() {
  const t = await getTranslations("apiMessages.notifications");
  try {
    const session = await requireAuth();
    await markAllNotificationsRead(session.user.id);

    return NextResponse.json(
      { data: null, error: null, message: t("allMarkedRead") },
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
      { data: null, error: "server_error", message: t("updateAllFailed") },
      { status: 500 },
    );
  }
}
