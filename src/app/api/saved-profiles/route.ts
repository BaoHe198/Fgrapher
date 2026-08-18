import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const saveSchema = z.object({ profileId: z.string().min(1) });

export async function GET() {
  try {
    const session = await requireAuth();

    // SavedProfile.profileId isn't a Prisma relation (no @relation declared
    // on the model), so resolve the actual profiles in a second query.
    const saved = await db.savedProfile.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    const profiles = await db.profile.findMany({
      where: { id: { in: saved.map((s) => s.profileId) } },
      include: { user: { select: { username: true, name: true, firstName: true, avatar: true } } },
    });

    return NextResponse.json({ data: profiles, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load saved profiles" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Invalid input" },
        { status: 400 },
      );
    }

    await db.savedProfile.upsert({
      where: {
        userId_profileId: { userId: session.user.id, profileId: parsed.data.profileId },
      },
      create: { userId: session.user.id, profileId: parsed.data.profileId },
      update: {},
    });

    return NextResponse.json({ data: null, error: null, message: "Saved" }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to save profile" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Missing profileId" },
        { status: 400 },
      );
    }

    await db.savedProfile.deleteMany({ where: { userId: session.user.id, profileId } });

    return NextResponse.json({ data: null, error: null, message: "Removed" }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to remove saved profile" },
      { status: 500 },
    );
  }
}
