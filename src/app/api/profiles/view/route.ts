import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PROFILE_VIEW_COOKIE,
  PROFILE_VIEW_COOKIE_PATH,
  VIEW_DEDUPE_WINDOW_SECONDS,
  parseViewState,
  rememberView,
  serializeViewState,
  shouldCountView,
} from "@/lib/profile-views";
import { incrementProfileView } from "@/services/public-profile";

// Counts one profile view, at most once per browser per profile per day.
//
// This lives in a route handler rather than in the profile page itself for a
// single hard reason: a Server Component cannot set cookies, and without a
// cookie there is nowhere to remember that this visitor was already counted.
// The page renders <ProfileViewBeacon>, which calls this once after mount.
//
// Side effect of moving it here: bots and link previewers that fetch the HTML
// without running JavaScript no longer inflate the number either.
//
// Deliberately does NOT call revalidatePublicProfile — viewCount is shown
// only on the owner's own dashboard, which reads it uncached. Busting the
// public profile cache on every view would turn the cache off.

const viewSchema = z.object({ profileId: z.string().min(1).max(64) });

// Always 200 with `{ counted }`. A beacon has no UI to show an error in, so
// distinguishing "not counted because you already viewed it" from "not
// counted because that profile is gone" would only give a scraper a cheap
// way to probe which profile ids exist.
const result = (counted: boolean) =>
  NextResponse.json(
    { data: { counted }, error: null, message: null },
    { status: 200 },
  );

export async function POST(request: Request) {
  try {
    const parsed = viewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "invalid_request", message: null },
        { status: 400 },
      );
    }
    const { profileId } = parsed.data;

    const cookieStore = await cookies();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const state = parseViewState(cookieStore.get(PROFILE_VIEW_COOKIE)?.value);

    // Check the cookie before touching the database — the repeat-view case is
    // the common one, and it should cost nothing.
    if (!shouldCountView(state, profileId, nowSeconds)) {
      return result(false);
    }

    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { userId: true, isPublished: true },
    });
    if (!profile || !profile.isPublished) {
      return result(false);
    }

    // The page already hides the beacon from the profile's owner; this is the
    // check that actually holds, since the request is trivially replayable.
    const session = await auth();
    if (session?.user?.id === profile.userId) {
      return result(false);
    }

    incrementProfileView(profileId);

    cookieStore.set(
      PROFILE_VIEW_COOKIE,
      serializeViewState(rememberView(state, profileId, nowSeconds)),
      {
        // Scoped to this one endpoint so ~1.5KB of view history never rides
        // along on page navigations, images, or any other API call.
        path: PROFILE_VIEW_COOKIE_PATH,
        maxAge: VIEW_DEDUPE_WINDOW_SECONDS,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    );

    return result(true);
  } catch {
    // Analytics must never surface as a failure to the visitor.
    return result(false);
  }
}
