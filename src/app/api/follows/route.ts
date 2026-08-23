import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

const followSchema = z.object({ userId: z.string().min(1) });

// Dormant while SOCIAL_FEED_ENABLED=false — see CLAUDE.md.
export async function POST(request: Request) {
  if (!features.socialFeedEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = followSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Invalid input" },
        { status: 400 },
      );
    }
    if (parsed.data.userId === session.user.id) {
      return NextResponse.json(
        {
          data: null,
          error: "invalid_target",
          message: "You cannot follow yourself",
        },
        { status: 400 },
      );
    }

    await db.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: parsed.data.userId,
        },
      },
      create: { followerId: session.user.id, followingId: parsed.data.userId },
      update: {},
    });

    return NextResponse.json(
      { data: null, error: null, message: "Followed" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to follow" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!features.socialFeedEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Missing userId" },
        { status: 400 },
      );
    }

    await db.follow.deleteMany({
      where: { followerId: session.user.id, followingId: userId },
    });

    return NextResponse.json(
      { data: null, error: null, message: "Unfollowed" },
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
      { data: null, error: "server_error", message: "Failed to unfollow" },
      { status: 500 },
    );
  }
}
