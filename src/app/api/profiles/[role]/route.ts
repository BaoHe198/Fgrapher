import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validations/profile";

export async function GET(_request: Request, { params }: { params: Promise<{ role: string }> }) {
  try {
    const session = await requireAuth();
    const { role } = await params;

    if (!(Object.values(Role) as string[]).includes(role)) {
      return NextResponse.json(
        { data: null, error: "invalid_role", message: "Unknown role" },
        { status: 400 },
      );
    }

    const profile = await db.profile.findUnique({
      where: { userId_role: { userId: session.user.id, role: role as Role } },
    });

    return NextResponse.json({ data: profile, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ role: string }> }) {
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
    const parsed = updateProfileSchema.safeParse(body);
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

    const profile = await db.profile.upsert({
      where: { userId_role: { userId: session.user.id, role: role as Role } },
      create: { userId: session.user.id, role: role as Role, ...parsed.data },
      update: parsed.data,
    });

    return NextResponse.json(
      { data: profile, error: null, message: "Profile updated" },
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
      { data: null, error: "server_error", message: "Failed to update profile" },
      { status: 500 },
    );
  }
}
