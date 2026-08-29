import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import {
  AlbumNotFoundError,
  AlbumNotOwnedError,
  restoreAlbum,
} from "@/services/albums";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.albums");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const album = await restoreAlbum(id, session.user.id);
    return NextResponse.json(
      { data: album, error: null, message: t("albumRestored") },
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
        { data: null, error: "not_found", message: t("notFound") },
        { status: 404 },
      );
    }
    if (err instanceof AlbumNotOwnedError) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: t("albumNotOwned") },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("restoreFailed") },
      { status: 500 },
    );
  }
}
