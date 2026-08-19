import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { getUnreadConversationCount } from "@/services/messaging";

export async function GET() {
  try {
    const session = await requireAuth();
    const count = await getUnreadConversationCount(session.user.id);

    return NextResponse.json({ data: { count }, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load unread count" },
      { status: 500 },
    );
  }
}
