import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { AlbumNotFoundError, restoreMedia } from "@/services/albums";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.portfolio");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const media = await restoreMedia(id, session.user.id);
    return NextResponse.json(
      { data: media, error: null, message: t("mediaRestored") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof AlbumNotFoundError) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("mediaNotFound") },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("restoreFailed") },
      { status: 500 },
    );
  }
}
