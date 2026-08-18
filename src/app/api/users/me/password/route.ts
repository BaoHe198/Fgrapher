import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validations/user";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
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

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user?.passwordHash) {
      return NextResponse.json(
        {
          data: null,
          error: "no_password",
          message: "This account signs in with a social provider and has no password to change",
        },
        { status: 400 },
      );
    }

    const isValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { data: null, error: "invalid_password", message: "Current password is incorrect" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });

    return NextResponse.json(
      { data: null, error: null, message: "Password updated" },
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
      { data: null, error: "server_error", message: "Failed to update password" },
      { status: 500 },
    );
  }
}
