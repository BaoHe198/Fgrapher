import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const value = searchParams.get("value")?.toLowerCase().trim();

    if (!value || value.length < 3) {
      return NextResponse.json(
        { data: { available: false }, error: null, message: null },
        { status: 200 },
      );
    }

    const existing = await db.user.findUnique({ where: { username: value } });
    const available = !existing || existing.id === session.user.id;

    return NextResponse.json({ data: { available }, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to check username" },
      { status: 500 },
    );
  }
}
