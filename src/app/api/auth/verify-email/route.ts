import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyEmailToken } from "@/services/email-verification";

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

// Tokens are 256 bits of randomness, so this isn't holding back a
// realistic brute force — it caps how fast one source can probe the token
// space at all, in line with every other unauthenticated auth route here.
const VERIFY_RATE_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 };

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.auth");

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`verify-email:${ip}`, VERIFY_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: t("tooManyRequests") },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = verifyEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: "validation_error",
        message: t("verifyEmailInvalid"),
      },
      { status: 400 },
    );
  }

  const result = await verifyEmailToken(parsed.data.token);

  switch (result.status) {
    case "verified":
      return NextResponse.json(
        {
          data: { status: result.status },
          error: null,
          message: t("emailVerified"),
        },
        { status: 200 },
      );
    case "already_verified":
      // Not an error: mail clients prefetch links, and people click twice.
      return NextResponse.json(
        {
          data: { status: result.status },
          error: null,
          message: t("emailAlreadyVerified"),
        },
        { status: 200 },
      );
    case "expired":
      return NextResponse.json(
        {
          data: { status: result.status },
          error: "token_expired",
          message: t("verifyEmailExpired"),
        },
        { status: 400 },
      );
    default:
      return NextResponse.json(
        {
          data: { status: "invalid" },
          error: "invalid_token",
          message: t("verifyEmailInvalid"),
        },
        { status: 400 },
      );
  }
}
