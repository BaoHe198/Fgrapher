import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    const profileId = searchParams.get("profileId");

    if (!targetUserId || !profileId) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Missing userId or profileId" },
        { status: 400 },
      );
    }

    const [follow, saved] = await Promise.all([
      db.follow.findUnique({
        where: { followerId_followingId: { followerId: session.user.id, followingId: targetUserId } },
      }),
      db.savedProfile.findUnique({
        where: { userId_profileId: { userId: session.user.id, profileId } },
      }),
    ]);

    return NextResponse.json(
      { data: { isFollowing: Boolean(follow), isSaved: Boolean(saved) }, error: null, message: null },
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
      { data: null, error: "server_error", message: "Failed to load social state" },
      { status: 500 },
    );
  }
}
