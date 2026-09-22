import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { listCostumesForOwner } from "@/services/costumes";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const profileId = new URL(request.url).searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: "profileId required",
        },
        { status: 400 },
      );
    }

    const profile = await db.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.userId !== session.user.id) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: "Not your profile" },
        { status: 403 },
      );
    }

    const items = await listCostumesForOwner(profileId);
    return NextResponse.json(
      { data: items, error: null, message: null },
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
      { data: null, error: "server_error", message: "Failed to load outfits" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    await requireAuth();
    return NextResponse.json(
      {
        data: null,
        error: "catalogue_retired",
        message: "Create products in Chợ F instead",
      },
      { status: 410 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to add outfit" },
      { status: 500 },
    );
  }
}
