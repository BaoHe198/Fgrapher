import { NextResponse } from "next/server";

import { AuthError, requireActiveSubscription, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createServiceSchema } from "@/lib/validations/service";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createServiceSchema.safeParse(body);
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

    const profile = await db.profile.findUnique({ where: { id: parsed.data.profileId } });
    if (!profile || profile.userId !== session.user.id) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: "This profile does not belong to you" },
        { status: 403 },
      );
    }

    await requireActiveSubscription(session.user.id, profile.role);

    const service = await db.service.create({ data: parsed.data });

    return NextResponse.json(
      { data: service, error: null, message: "Service created" },
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
      { data: null, error: "server_error", message: "Failed to create service" },
      { status: 500 },
    );
  }
}
