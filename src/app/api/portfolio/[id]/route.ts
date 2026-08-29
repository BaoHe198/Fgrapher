import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.portfolio");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const media = await db.profileMedia.findUnique({
      where: { id },
      include: { profile: { select: { userId: true } } },
    });

    if (!media || media.profile.userId !== session.user.id) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("mediaNotFound") },
        { status: 404 },
      );
    }

    // Prompt G3, VIỆC 2 — soft delete now, not an immediate hard delete
    // (and the Cloudinary asset is intentionally left alone here too) —
    // both only actually happen once TRASH_TTL_DAYS pass, via the
    // purge-trashed-media cron (services/albums.ts's purgeExpiredTrash).
    await db.profileMedia.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(
      { data: null, error: null, message: t("mediaMovedToTrash") },
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
      { data: null, error: "server_error", message: t("deleteFailed") },
      { status: 500 },
    );
  }
}
