import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

// NOT gated behind SOCIAL_FEED_ENABLED like the rest of /api/follows —
// this endpoint also serves the (non-social, always-on) "Save profile"
// state, so the route as a whole must keep working. Only the follow
// lookup itself is skipped while the flag is off.
export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.follows");
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    const profileId = searchParams.get("profileId");

    if (!targetUserId || !profileId) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: t("missingParams"),
        },
        { status: 400 },
      );
    }

    const [follow, saved] = await Promise.all([
      features.socialFeedEnabled
        ? db.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: session.user.id,
                followingId: targetUserId,
              },
            },
          })
        : null,
      db.savedProfile.findUnique({
        where: { userId_profileId: { userId: session.user.id, profileId } },
      }),
    ]);

    return NextResponse.json(
      {
        data: { isFollowing: Boolean(follow), isSaved: Boolean(saved) },
        error: null,
        message: null,
      },
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
      {
        data: null,
        error: "server_error",
        message: t("socialStateLoadFailed"),
      },
      { status: 500 },
    );
  }
}
