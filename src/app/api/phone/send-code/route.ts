import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { toE164VN } from "@/lib/phone";
import {
  DEV_BYPASS_CODE,
  canVerifyPhone,
  isDevBypassActive,
  startPhoneVerification,
} from "@/lib/sms";
import { sendPhoneCodeSchema } from "@/lib/validations/phone";

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.phone");
  try {
    await requireAuth();

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
