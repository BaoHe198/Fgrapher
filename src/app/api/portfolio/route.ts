import { NextResponse } from "next/server";

import {
  AuthError,
  requireActiveSubscription,
  requireAuth,
} from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ROLE_PLANS } from "@/lib/constants/plans";
import { createPortfolioMediaSchema } from "@/lib/validations/portfolio";
import { runModeration } from "@/services/moderation";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createPortfolioMediaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
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
          message: "This profile does not belong to you",
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
      db.profileMedia.count({ where: { profileId: profile.id } }),
    ]);

    const limit = ROLE_PLANS[profile.role]?.maxPortfolioImages;
    if (limit && existingCount >= limit) {
      return NextResponse.json(
        {
          data: null,
          error: "limit_reached",
          message: `Your plan allows up to ${limit} portfolio items`,
        },
        { status: 403 },
      );
    }

    const media = await db.profileMedia.create({
      data: {
        profileId: profile.id,
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
      { data: media, error: null, message: "Media added" },
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
      { data: null, error: "server_error", message: "Failed to save media" },
      { status: 500 },
    );
  }
}
