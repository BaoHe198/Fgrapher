import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { deleteComment, PostError } from "@/services/posts";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  if (!features.socialFeedEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }
  const t = await getTranslations("apiMessages.comments");

  try {
    const session = await requireAuth();
    const { id, commentId } = await params;
    await deleteComment({ postId: id, commentId, userId: session.user.id });
    return NextResponse.json(
      { data: null, error: null, message: t("deleted") },
      { status: 200 },
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
        {
          data: null,
          error: "post_error",
          message: err.status === 403 ? t("notYours") : t("notFound"),
        },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("deleteFailed") },
      { status: 500 },
    );
  }
}
