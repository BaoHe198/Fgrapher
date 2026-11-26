import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  AuthError,
  requireActiveSubscription,
  requireAuth,
} from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PORTFOLIO_ROLES } from "@/lib/constants";
import { ROLE_PLANS } from "@/lib/constants/plans";
import {
  UploadVerificationError,
  verifyPortfolioUpload,
} from "@/lib/media/cloudinary";
import { linkedVideo, linkedVideoUrl } from "@/lib/media/video-link";
import { lookUpVimeo } from "@/lib/media/vimeo";
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

    if (!PORTFOLIO_ROLES.includes(profile.role)) {
      return NextResponse.json(
        {
          data: null,
          error: "forbidden",
          message: "This role uses product listings instead of a portfolio",
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

    // Two ways in: a file this user uploaded to Cloudinary, checked there,
    // or a link to YouTube or Vimeo, which is stored in one canonical form
    // whatever was pasted. Anything else without a publicId is refused. A
    // linked video goes through the same review queue as an upload (it
    // starts PENDING below), and plays only from the address reviewed.
    const link = parsed.data.publicId ? null : linkedVideo(parsed.data.url);
    if (!parsed.data.publicId && !link) {
      return NextResponse.json(
        { data: null, error: "invalid_link", message: t("videoLinkInvalid") },
        { status: 400 },
      );
    }
    const url = link ? linkedVideoUrl(link) : parsed.data.url;

    // A Vimeo video that is gone, private, or not allowed to be embedded
    // would be a dead tile on the provider's page: said now instead. When
    // Vimeo cannot be reached the link is taken on trust, like a YouTube
    // one; the reviewer opens it either way.
    if (link?.provider === "vimeo") {
      const found = await lookUpVimeo(link.id, link.hash);
      if (found.status === "missing") {
        return NextResponse.json(
          {
            data: null,
            error: "invalid_link",
            message: t("videoLinkUnavailable"),
          },
          { status: 400 },
        );
      }
    }

    if (link) {
      const already = await db.profileMedia.findFirst({
        where: { profileId: profile.id, url, deletedAt: null },
        select: { id: true },
      });
      if (already) {
        return NextResponse.json(
          {
            data: null,
            error: "duplicate",
            message: t("videoLinkDuplicate"),
          },
          { status: 409 },
        );
      }
    } else {
      await verifyPortfolioUpload({
        publicId: parsed.data.publicId!,
        url: parsed.data.url,
        userId: session.user.id,
        type: parsed.data.type,
      });
    }

    const media = await db.profileMedia.create({
      data: {
        profileId: profile.id,
        albumId: parsed.data.albumId,
        url,
        publicId: link ? null : parsed.data.publicId,
        type: link ? "VIDEO" : parsed.data.type,
        title: parsed.data.title,
        // A linked video is laid out at the players' own 16:9.
        width: link ? 1280 : parsed.data.width,
        height: link ? 720 : parsed.data.height,
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
    if (err instanceof UploadVerificationError) {
      return NextResponse.json(
        { data: null, error: "invalid_upload", message: t("invalidInput") },
        { status: 400 },
      );
    }

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
