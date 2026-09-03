import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { toE164VN } from "@/lib/phone";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  DEV_BYPASS_CODE,
  canVerifyPhone,
  isDevBypassActive,
  startPhoneVerification,
} from "@/lib/sms";
import { sendPhoneCodeSchema } from "@/lib/validations/phone";

// Authenticated (requireAuth below), but nothing previously capped how
// many *different* phone numbers one account could trigger an SMS to —
// this is about limiting Twilio send-cost/SMS-toll abuse from a
// compromised or malicious account, not brute force (Twilio Verify's own
// attempt cap on the code itself already handles that).
const PHONE_SEND_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.phone");
  try {
    const session = await requireAuth();

    const rateLimit = checkRateLimit(
      `phone-send:${session.user.id}`,
      PHONE_SEND_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          data: null,
          error: "too_many_requests",
          message: t("tooManyRequests"),
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    if (!canVerifyPhone()) {
      return NextResponse.json(
        { data: null, error: "not_configured", message: t("notConfigured") },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = sendPhoneCodeSchema.safeParse(body);
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

    const e164 = toE164VN(parsed.data.phone);
    if (!e164) {
      return NextResponse.json(
        { data: null, error: "invalid_phone", message: t("invalidPhone") },
        { status: 400 },
      );
    }

    await startPhoneVerification(e164);

    return NextResponse.json(
      {
        data: {
          phone: e164,
          devHint: isDevBypassActive() ? DEV_BYPASS_CODE : undefined,
        },
        error: null,
        message: t("codeSent"),
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
      { data: null, error: "server_error", message: t("sendFailed") },
      { status: 500 },
    );
  }
}
