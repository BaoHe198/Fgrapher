import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAnyRole, requireAuth } from "@/lib/auth-helpers";
import { PROVIDER_ROLES } from "@/lib/constants";
import {
  calendarFeedUrl,
  getCalendarFeedToken,
  issueCalendarFeedToken,
  revokeCalendarFeedToken,
} from "@/services/work-calendar";

// The signed-in provider's calendar-subscription address: read it, switch it
// on or replace it (POST), switch it off (DELETE). The feed itself is served
// by ./[token]/route.ts, to a calendar app that has no session.

async function respond(
  run: (userId: string) => Promise<string | null>,
  status = 200,
) {
  const t = await getTranslations("apiMessages.calendar");
  try {
    const session = await requireAuth();
    requireAnyRole(session, PROVIDER_ROLES);
    const token = await run(session.user.id);
    return NextResponse.json(
      {
        data: { url: token ? calendarFeedUrl(token) : null },
        error: null,
        message: null,
      },
      { status },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: t("providerOnly") },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("feedFailed") },
      { status: 500 },
    );
  }
}

export function GET() {
  return respond(getCalendarFeedToken);
}

export function POST() {
  return respond(issueCalendarFeedToken, 201);
}

export function DELETE() {
  return respond(async (userId) => {
    await revokeCalendarFeedToken(userId);
    return null;
  });
}
