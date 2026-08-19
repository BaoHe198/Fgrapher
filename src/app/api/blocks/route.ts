import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { blockUserSchema } from "@/lib/validations/message";
import { blockUser, MessagingError, unblockUser } from "@/services/messaging";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = blockUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "userId is required" },
        { status: 400 },
      );
    }

    await blockUser(session.user.id, parsed.data.userId, parsed.data.reason);

    return NextResponse.json({ data: null, error: null, message: "User blocked" }, { status: 200 });
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
      { data: null, error: "server_error", message: "Failed to block user" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = blockUserSchema.pick({ userId: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "userId is required" },
        { status: 400 },
      );
    }

    await unblockUser(session.user.id, parsed.data.userId);

    return NextResponse.json({ data: null, error: null, message: "User unblocked" }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to unblock user" },
      { status: 500 },
    );
  }
}
