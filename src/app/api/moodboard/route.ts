import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import {
  listPinnedIds,
  MoodboardFullError,
  MoodboardPhotoNotFoundError,
  pinPhoto,
  unpinPhoto,
} from "@/services/moodboard";

// "Bảng ý tưởng": pin and unpin single portfolio photos. Signed-in users
// only, and only ever their own board - the user id comes from the
// session, never from the request.
const bodySchema = z.object({ mediaId: z.string().trim().min(1).max(64) });

function authFailure(err: AuthError) {
  return NextResponse.json(
    { data: null, error: "unauthorized", message: err.message },
    { status: err.status },
  );
}

export async function GET() {
  const t = await getTranslations("apiMessages.moodboard");
  try {
    const session = await requireAuth();
    return NextResponse.json(
      {
        data: await listPinnedIds(session.user.id),
        error: null,
        message: null,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) return authFailure(err);
    return NextResponse.json(
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.moodboard");
  try {
    const session = await requireAuth();
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }
    await pinPhoto(session.user.id, parsed.data.mediaId);
    return NextResponse.json(
      { data: { pinned: true }, error: null, message: t("pinned") },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) return authFailure(err);
    if (err instanceof MoodboardPhotoNotFoundError) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("photoNotFound") },
        { status: 404 },
      );
    }
    if (err instanceof MoodboardFullError) {
      return NextResponse.json(
        { data: null, error: "board_full", message: t("boardFull") },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("saveFailed") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const t = await getTranslations("apiMessages.moodboard");
  try {
    const session = await requireAuth();
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }
    await unpinPhoto(session.user.id, parsed.data.mediaId);
    return NextResponse.json(
      { data: { pinned: false }, error: null, message: t("unpinned") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) return authFailure(err);
    return NextResponse.json(
      { data: null, error: "server_error", message: t("saveFailed") },
      { status: 500 },
    );
  }
}
