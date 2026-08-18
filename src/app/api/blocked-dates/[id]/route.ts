import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const blockedDate = await db.blockedDate.findUnique({ where: { id } });
    if (!blockedDate || blockedDate.userId !== session.user.id) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Blocked date not found" },
        { status: 404 },
      );
    }

    await db.blockedDate.delete({ where: { id } });

    return NextResponse.json(
      { data: null, error: null, message: "Date unblocked" },
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
      { data: null, error: "server_error", message: "Failed to unblock date" },
      { status: 500 },
    );
  }
}
