import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { listNotifications } from "@/services/notification";

export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.notifications");
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const unreadOnly = searchParams.get("unread") === "true";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const result = await listNotifications({
      userId: session.user.id,
      unreadOnly,
      page,
    });

    return NextResponse.json(
      {
        data: result.notifications,
        error: null,
        message: null,
        total: result.total,
        unreadCount: result.unreadCount,
        page: result.page,
        totalPages: result.totalPages,
      },
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
