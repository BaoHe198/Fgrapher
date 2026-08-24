import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { updateServiceAreasSchema } from "@/lib/validations/profile";

// Prompt B4, VIỆC 3 — "chọn thêm nhiều tỉnh phục vụ" beyond a profile's
// primary Profile.provinceId. A separate route rather than folded into
// PATCH /api/profiles/[role]: ProfileServiceArea is a join table, not a
// scalar column, so it doesn't fit that route's generic
// db.profile.upsert(parsed.data) pattern.

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ role: string }> },
) {
  try {
    const session = await requireAuth();
    const { role } = await params;

    if (!(Object.values(Role) as string[]).includes(role)) {
      return NextResponse.json(
        { data: null, error: "invalid_role", message: "Unknown role" },
        { status: 400 },
      );
    }
    if (!session.user.roles.includes(role as Role)) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: "You don't have this role" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = updateServiceAreasSchema.safeParse(body);
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

    const profile = await db.profile.findUnique({
      where: { userId_role: { userId: session.user.id, role: role as Role } },
      select: { id: true },
    });
    if (!profile) {
      return NextResponse.json(
        {
          data: null,
          error: "not_found",
          message: "Save your profile details before setting service areas",
        },
        { status: 404 },
      );
    }

    const provinceIds = Array.from(new Set(parsed.data.provinceIds));

    // Replace-the-set, not a diff — this route always receives the full
    // desired list from the client (a multi-select), so a delete-then-
    // create in one transaction is simpler and just as correct as a diff.
    await db.$transaction([
      db.profileServiceArea.deleteMany({ where: { profileId: profile.id } }),
      ...(provinceIds.length > 0
        ? [
            db.profileServiceArea.createMany({
              data: provinceIds.map((provinceId) => ({
                profileId: profile.id,
                provinceId,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return NextResponse.json(
      { data: { provinceIds }, error: null, message: "Service areas updated" },
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
      {
        data: null,
        error: "server_error",
        message: "Failed to update service areas",
      },
      { status: 500 },
    );
  }
}
