import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { countCartItems } from "@/services/marketplace";
import { getUnreadConversationCount } from "@/services/messaging";
import { countUnreadNotifications } from "@/services/notification";

// The three numbers the header shows on every signed-in page: unread
// conversations, unread notifications, units in the cart.
//
// They used to be three requests (/api/conversations/unread-count,
// /api/notifications?countOnly=true and the whole of /api/cart), sent after
// every page load and again on each poll. Each one ran its own sign-in check
// before its query. Here the check runs once and the three counts run
// together.
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const [unreadMessages, unreadNotifications, cartItems] = await Promise.all([
      getUnreadConversationCount(userId),
      countUnreadNotifications(userId),
      // Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
      features.marketplaceEnabled ? countCartItems(userId) : 0,
    ]);

    return NextResponse.json(
      {
        data: { unreadMessages, unreadNotifications, cartItems },
        error: null,
        message: null,
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

    // Nothing shows this text: the header keeps its last numbers when a
    // refresh fails. It is here for the API's usual response shape.
    const t = await getTranslations("apiMessages.notifications");
    return NextResponse.json(
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}
