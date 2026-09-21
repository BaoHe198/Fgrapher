import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { createCommentSchema } from "@/lib/validations/post";
import { addComment, listComments, PostError } from "@/services/posts";

function socialOff() {
  return NextResponse.json(
    { data: null, error: "not_found", message: "Not found" },
    { status: 404 },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!features.socialFeedEnabled) return socialOff();
  const { id } = await params;
  const comments = await listComments(id);
  return NextResponse.json(
    { data: comments, error: null, message: null },
    { status: 200 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!features.socialFeedEnabled) return socialOff();

  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);
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

    const comment = await addComment({
      postId: id,
      userId: session.user.id,
      content: parsed.data.content,
    });

    return NextResponse.json(
      { data: comment, error: null, message: null },
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
      { data: null, error: "server_error", message: "Failed to comment" },
      { status: 500 },
    );
  }
}
