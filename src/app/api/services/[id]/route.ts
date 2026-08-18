import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { updateServiceSchema } from "@/lib/validations/service";

async function assertOwnedService(id: string, userId: string) {
  const service = await db.service.findUnique({
    where: { id },
    include: { profile: { select: { userId: true } } },
  });
  return service && service.profile.userId === userId ? service : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const owned = await assertOwnedService(id, session.user.id);
    if (!owned) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Service not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = updateServiceSchema.safeParse(body);
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

    const service = await db.service.update({ where: { id }, data: parsed.data });

    return NextResponse.json(
      { data: service, error: null, message: "Service updated" },
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
      { data: null, error: "server_error", message: "Failed to update service" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const owned = await assertOwnedService(id, session.user.id);
    if (!owned) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Service not found" },
        { status: 404 },
      );
    }

    await db.service.delete({ where: { id } });

    return NextResponse.json(
      { data: null, error: null, message: "Service deleted" },
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
      { data: null, error: "server_error", message: "Failed to delete service" },
      { status: 500 },
    );
  }
}
