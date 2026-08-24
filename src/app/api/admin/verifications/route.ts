import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { listPendingVerifications } from "@/services/admin";

export async function GET() {
  const t = await getTranslations("apiMessages.admin");
  try {
    await requireAdmin();
    const verifications = await listPendingVerifications();

    return NextResponse.json(
      { data: verifications, error: null, message: null },
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
        message: t("verificationQueueLoadFailed"),
      },
      { status: 500 },
    );
  }
}
