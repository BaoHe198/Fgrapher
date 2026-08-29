import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { reorderAlbumsSchema } from "@/lib/validations/album";
import { AlbumNotOwnedError, reorderAlbums } from "@/services/albums";

export async function PATCH(request: Request) {
  const t = await getTranslations("apiMessages.albums");
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = reorderAlbumsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    await reorderAlbums(profileId, session.user.id, parsed.data.order);
    return NextResponse.json(
      { data: null, error: null, message: t("orderUpdated") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof AlbumNotOwnedError) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: t("albumNotOwned") },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("updateFailed") },
      { status: 500 },
    );
  }
}
