import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { updateMeSchema } from "@/lib/validations/user";

export async function GET() {
  try {
    const session = await requireAuth();
    const user = await db.user.findUnique({ where: { id: session.user.id } });

    return NextResponse.json({ data: user, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load account" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = updateMeSchema.safeParse(body);
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

    const user = await db.user.update({
      where: { id: session.user.id },
      data: parsed.data,
    });

    return NextResponse.json(
      { data: user, error: null, message: "Account updated" },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const field = (err.meta?.target as string[] | undefined)?.[0] ?? "value";
      return NextResponse.json(
        { data: null, error: "conflict", message: `This ${field} is already taken` },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to update account" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const session = await requireAuth();

    await db.user.update({
      where: { id: session.user.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(
      { data: null, error: null, message: "Account deleted" },
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
      { data: null, error: "server_error", message: "Failed to delete account" },
      { status: 500 },
    );
  }
}
