import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { markConversationRead, MessagingError } from "@/services/messaging";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    await markConversationRead(id, session.user.id);

    return NextResponse.json({ data: null, error: null, message: "Marked as read" }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof MessagingError) {
      return NextResponse.json(
        { data: null, error: "messaging_error", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to mark as read" },
      { status: 500 },
    );
  }
}
