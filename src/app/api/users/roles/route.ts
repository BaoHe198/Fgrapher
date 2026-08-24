import { NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
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

    // updateRolesSchema can't read the runtime feature flag (it's built at
    // module scope), so CAMERA_SHOP is checked here instead — the roles UI
    // already hides it while MARKETPLACE_ENABLED=false (see CLAUDE.md), but
    // a direct API call could otherwise still grant an active-looking
    // CAMERA_SHOP role and a publishable, searchable profile.
    if (
      !features.marketplaceEnabled &&
      parsed.data.roles.includes("CAMERA_SHOP")
    ) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: "Camera Shop is not available yet",
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
