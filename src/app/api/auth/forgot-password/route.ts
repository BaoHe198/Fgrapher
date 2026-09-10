import crypto from "crypto";

import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { resetPasswordEmailHtml, sendEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
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
  // can't be used to enumerate registered emails.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db.verificationToken.deleteMany({ where: { identifier: email } });
    await db.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    // appUrl(), not `process.env.NEXTAUTH_URL` — that var is deliberately
    // unset on Vercel Preview (see lib/env.ts), which made this produce the
    // literal string "undefined/reset-password?token=…".
    const resetUrl = appUrl(`/reset-password?token=${token}`);
    const result = await sendEmail({
      to: email,
      // Vietnamese-first, matching resetPasswordEmailHtml's own copy
      // (CLAUDE.md rule 10) — the subject was the last English string left
      // in this flow.
      subject: "Đặt lại mật khẩu Fgrapher",
      html: resetPasswordEmailHtml({ resetUrl }),
      // The body contains the raw reset link.
      sensitive: true,
      // No idempotency key on purpose: asking for a second reset link is a
      // legitimate repeat of a *new* event, and each request mints a fresh
      // token, so every call must actually send.
    });

    if (!result.success && !result.queued) {
      console.error("[Password Reset] Email send failed", {
        error: result.error,
      });
    }
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
