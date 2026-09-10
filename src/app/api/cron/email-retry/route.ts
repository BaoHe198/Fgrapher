import { NextResponse } from "next/server";

import { AuthError, requireCronSecret } from "@/lib/auth-helpers";
import {
  getEmailOutboxStats,
  processEmailOutbox,
} from "@/services/email-outbox";

// GET, not POST: Vercel Cron invokes the path with a GET request and
// authenticates with an `Authorization: Bearer $CRON_SECRET` header — not
// a custom `X-Cron-Secret` one. The original exported only POST and
// checked only `x-cron-secret`, so in production this endpoint would have
// answered every scheduled invocation with 405 and the outbox would never
// have drained. requireCronSecret() is the same helper the nine sibling
// crons already use (and the one hardened against failing open when
// CRON_SECRET is unset — see docs/PRE_LAUNCH_REVIEW.md item 3).
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    requireCronSecret(request);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    throw err;
  }

  const result = await processEmailOutbox();
  const stats = await getEmailOutboxStats();

  // No try/catch around the work itself: an unhandled failure should surface
  // as a 500 in Vercel's cron log rather than be flattened into a 200, and
  // the original's `message: error.message` echoed internal error text
  // (connection strings, provider payloads) straight into the response body.
  return NextResponse.json(
    { data: { ...result, stats }, error: null, message: null },
    { status: 200 },
  );
}
