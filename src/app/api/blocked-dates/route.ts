import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createBlockedDateSchema } from "@/lib/validations/availability";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createBlockedDateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }

    const blockedDate = await db.blockedDate.upsert({
      where: { userId_date: { userId: session.user.id, date: new Date(parsed.data.date) } },
      create: {
        userId: session.user.id,
        date: new Date(parsed.data.date),
        reason: parsed.data.reason,
      },
      update: { reason: parsed.data.reason },
    });

    return NextResponse.json(
      { data: blockedDate, error: null, message: "Date blocked" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to block date" },
      { status: 500 },
    );
  }
}
