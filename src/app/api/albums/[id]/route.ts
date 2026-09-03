import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { updateAlbumSchema } from "@/lib/validations/album";
import {
  AlbumNotFoundError,
  AlbumNotOwnedError,
  deleteAlbum,
  getAlbumWithMedia,
  updateAlbum,
} from "@/services/albums";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.albums");
  try {
    const session = await requireAuth();
    const { id } = await params;
    const album = await getAlbumWithMedia(id, session.user.id);
    if (!album) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("notFound") },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: album, error: null, message: null },
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
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.albums");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = updateAlbumSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? t("invalidInput"),
        },
        { status: 400 },
      );
    }

    const album = await updateAlbum(id, session.user.id, parsed.data);
    return NextResponse.json(
      { data: album, error: null, message: t("albumUpdated") },
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
      { data: null, error: "server_error", message: t("updateFailed") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.albums");
  try {
    const session = await requireAuth();
    const { id } = await params;

    await deleteAlbum(id, session.user.id);
    return NextResponse.json(
      { data: null, error: null, message: t("albumMovedToTrash") },
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
      { data: null, error: "server_error", message: t("deleteFailed") },
      { status: 500 },
    );
  }
}
