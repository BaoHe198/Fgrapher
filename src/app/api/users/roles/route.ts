import { NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { updateRolesSchema } from "@/lib/validations/user";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = updateRolesSchema.safeParse(body);
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

    // CUSTOMER is always active, regardless of what the client sends.
    const roles = Array.from(
      new Set([...parsed.data.roles, "CUSTOMER" as const]),
    );

    const userRoles = await db.$transaction(
      roles.map((role) =>
        db.userRole.upsert({
          where: { userId_role: { userId: session.user.id, role } },
          create: { userId: session.user.id, role, active: true },
          update: { active: true },
        }),
      ),
    );

    return NextResponse.json(
      {
        data: { roles: userRoles.map((r) => r.role) },
        error: null,
        message: "Roles saved",
      },
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
      { data: null, error: "server_error", message: "Failed to save roles" },
      { status: 500 },
    );
  }
}
