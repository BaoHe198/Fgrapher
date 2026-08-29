import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  AuthError,
  requireActiveSubscription,
  requireAuth,
} from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createAlbumSchema } from "@/lib/validations/album";
import { createAlbum, listAlbums } from "@/services/albums";

export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.albums");
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    const albums = await listAlbums(profileId);
    return NextResponse.json(
      { data: albums, error: null, message: null },
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
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.albums");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createAlbumSchema.safeParse(body);
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

    const profile = await db.profile.findUnique({
      where: { id: parsed.data.profileId },
    });
    if (!profile || profile.userId !== session.user.id) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: t("profileNotOwned") },
        { status: 403 },
      );
    }
    await requireActiveSubscription(session.user.id, profile.role);

    const album = await createAlbum(profile.id, parsed.data);
    return NextResponse.json(
      { data: album, error: null, message: t("albumCreated") },
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
      { data: null, error: "server_error", message: t("createFailed") },
      { status: 500 },
    );
  }
}
