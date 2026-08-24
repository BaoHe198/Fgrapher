import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { getConsentStats } from "@/services/admin";

export async function GET() {
  const t = await getTranslations("apiMessages.admin");
  try {
    await requireAdmin();
    const stats = await getConsentStats();

    return NextResponse.json(
      { data: stats, error: null, message: null },
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
      {
        data: null,
        error: "server_error",
        message: t("consentStatsFailed"),
      },
      { status: 500 },
    );
  }
}
