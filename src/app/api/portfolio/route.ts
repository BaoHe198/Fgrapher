import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  AuthError,
  requireActiveSubscription,
  requireAuth,
} from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ROLE_PLANS } from "@/lib/constants/plans";
import { getCreatePortfolioMediaSchema } from "@/lib/validations/portfolio";
import { runModeration } from "@/services/moderation";

export async function POST(request: Request) {
  const [t, tValidation] = await Promise.all([
    getTranslations("apiMessages.portfolio"),
    getTranslations("libServices.validation.portfolio"),
  ]);
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = getCreatePortfolioMediaSchema(tValidation).safeParse(body);
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
        {
          data: null,
          error: "forbidden",
          message: t("profileNotOwned"),
        },
        { status: 403 },
      );
    }

    await requireActiveSubscription(session.user.id, profile.role);

    const [maxOrder, existingCount] = await Promise.all([
      db.profileMedia.aggregate({
        where: { profileId: profile.id },
        _max: { order: true },
      }),
      // Prompt G3, VIỆC 3 — "tính trên TỔNG số ảnh của hồ sơ chứ không
      // phải theo từng album": unchanged by albums (this already counted
      // across the whole profile, never per-album), just now also
      // excludes soft-deleted photos so a trashed photo doesn't count
      // against the limit while it's awaiting purge.
      db.profileMedia.count({
        where: { profileId: profile.id, deletedAt: null },
      }),
    ]);

    const limit = ROLE_PLANS[profile.role]?.maxPortfolioImages;
    if (limit && existingCount >= limit) {
      return NextResponse.json(
        {
          data: null,
          error: "limit_reached",
          message: t("limitReached", { limit }),
        },
        { status: 403 },
      );
    }

    if (parsed.data.albumId) {
      const album = await db.album.findUnique({
        where: { id: parsed.data.albumId },
      });
      if (!album || album.profileId !== profile.id) {
        return NextResponse.json(
          { data: null, error: "not_found", message: t("albumNotFound") },
          { status: 404 },
        );
      }
    }

    const media = await db.profileMedia.create({
      data: {
        profileId: profile.id,
        albumId: parsed.data.albumId,
        url: parsed.data.url,
        publicId: parsed.data.publicId,
        type: parsed.data.type,
        title: parsed.data.title,
        width: parsed.data.width,
        height: parsed.data.height,
        order: (maxOrder._max.order ?? -1) + 1,
        // Server-set, never trusted from the client — the request having
        // passed createPortfolioMediaSchema's rightsConfirmed refine is
        // what gets us here at all.
        rightsConfirmedAt: new Date(),
      },
    });

    // Fire-and-forget: MockScanner always defers to the human queue today
    // (see services/moderation.ts), so this never blocks the response —
    // but a real scanner might genuinely be slow, and the upload should
    // never hang on it.
    void runModeration(media.id);

    return NextResponse.json(
      { data: media, error: null, message: t("mediaAdded") },
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
      { data: null, error: "server_error", message: t("saveFailed") },
      { status: 500 },
    );
  }
}
