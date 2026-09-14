import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/services/password-reset";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

// Keyed by IP, not email — the endpoint always reports success regardless
// of whether the account exists (see below), so this can't be used to
// enumerate registered emails; it's purely a cap on how many reset emails
// one source can trigger (email-bombing) and how many token rows it can
// insert per hour, unrelated to which specific address is targeted.
const FORGOT_PASSWORD_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.auth");

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(
    `forgot-password:${ip}`,
    FORGOT_PASSWORD_RATE_LIMIT,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: t("tooManyRequests") },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);

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

  const { email } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });

  // Always report success, even if no account exists, so this endpoint
  // can't be used to enumerate registered emails. sendPasswordResetEmail
  // never throws, so a failure issuing or sending the link can't turn into
  // a 500 that only registered addresses would ever produce.
  if (user) {
    await sendPasswordResetEmail({ userId: user.id, email: user.email });
  }

  return NextResponse.json(
    {
      data: null,
      error: null,
      message: t("resetLinkSent"),
    },
    { status: 200 },
  );
}
