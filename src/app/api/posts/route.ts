import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { createPostSchema } from "@/lib/validations/post";
import { createPost, listFeed, PostError } from "@/services/posts";

// Dormant while SOCIAL_FEED_ENABLED=false — see CLAUDE.md.
function socialOff() {
  return NextResponse.json(
    { data: null, error: "not_found", message: "Not found" },
    { status: 404 },
  );
}

export async function GET(request: Request) {
  if (!features.socialFeedEnabled) return socialOff();

  const { searchParams } = new URL(request.url);
  const tab =
    searchParams.get("tab") === "following" ? "following" : "discover";
  const session = await auth();

  const result = await listFeed({
    viewerId: session?.user?.id ?? null,
    tab,
    cursor: searchParams.get("cursor"),
  });

  return NextResponse.json(
    {
      data: result.data,
      nextCursor: result.nextCursor,
      error: null,
      message: null,
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  if (!features.socialFeedEnabled) return socialOff();

  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);
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

    const post = await createPost({
      userId: session.user.id,
      caption: parsed.data.caption,
      media: parsed.data.media,
    });

    return NextResponse.json(
      { data: post, error: null, message: "Post published" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof PostError) {
      return NextResponse.json(
        { data: null, error: "post_error", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to publish" },
      { status: 500 },
    );
  }
}
