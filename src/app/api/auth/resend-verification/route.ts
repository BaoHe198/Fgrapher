import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resendVerificationEmail } from "@/services/email-verification";

const resendSchema = z.object({
  // Trimmed before validation: a pasted address routinely carries
  // whitespace, and " a@b.com" would otherwise fail as invalid.
  email: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().email()),
  // Same two-value enum as the verification link. Optional and never a
  // gate: a missing or mangled preference falls back to monthly rather
  // than refusing to send someone their link.
  interval: z.enum(["month", "year"]).optional(),
});

// Two buckets, same reasoning as the login limiter in lib/auth.ts: the IP
// bucket caps how many verification emails one source can trigger, the
// email bucket stops someone mail-bombing one specific address from
// rotating IPs. The email bucket is not an enumeration oracle — the
// response is identical whether or not the address is registered, and the
// limit applies to unknown addresses too.
const RESEND_IP_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
const RESEND_EMAIL_RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.auth");

  const ip = getClientIp(request);
  const ipLimit = checkRateLimit(
    `resend-verification-ip:${ip}`,
    RESEND_IP_RATE_LIMIT,
  );
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { data: null, error: "too_many_requests", message: t("tooManyRequests") },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "validation_error", message: t("invalidInput") },
      { status: 400 },
    );
  }

  const { email, interval } = parsed.data;

  // Lower-cased for the bucket key only, never for the lookup: otherwise
  // "a@b.com", "A@b.com" and "A@B.COM" each get their own budget and the
  // per-address limit is trivially multiplied.
  const emailLimit = checkRateLimit(
    `resend-verification-email:${email.toLowerCase()}`,
    RESEND_EMAIL_RATE_LIMIT,
  );
  if (emailLimit.allowed) {
    await resendVerificationEmail(email, interval);
  }

  // Always the same response, whether the address is registered, already
  // verified, suspended, OAuth-only, or rate-limited on the email bucket.
  // Anything else turns this endpoint into an account-existence oracle.
  return NextResponse.json(
    { data: null, error: null, message: t("verificationEmailSent") },
    { status: 200 },
  );
}
