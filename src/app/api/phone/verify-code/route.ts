import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { toE164VN } from "@/lib/phone";
import { canVerifyPhone, checkPhoneVerification } from "@/lib/sms";
import { verifyPhoneCodeSchema } from "@/lib/validations/phone";

export async function POST(request: Request) {
  const t = await getTranslations("apiMessages.phone");
  try {
    const session = await requireAuth();

    if (!canVerifyPhone()) {
      return NextResponse.json(
        { data: null, error: "not_configured", message: t("notConfigured") },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = verifyPhoneCodeSchema.safeParse(body);
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

    const approved = await checkPhoneVerification(e164, parsed.data.code);
    if (!approved) {
      return NextResponse.json(
        { data: null, error: "code_invalid", message: t("codeInvalid") },
        { status: 400 },
      );
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { phone: e164, phoneVerified: true, phoneVerifiedAt: new Date() },
    });

    return NextResponse.json(
      { data: { phone: e164 }, error: null, message: t("verified") },
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
      { data: null, error: "server_error", message: t("verifyFailed") },
      { status: 500 },
    );
  }
}
