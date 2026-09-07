import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError } from "@/lib/auth-helpers";
import { requireAdmin } from "@/lib/admin";
import { listPendingPayments } from "@/services/payments";

export async function GET() {
  const t = await getTranslations("apiMessages.admin");
  try {
    await requireAdmin();

    const payments = await listPendingPayments();

    return NextResponse.json(
      { data: payments, error: null, message: null },
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
      { data: null, error: "server_error", message: t("paymentsLoadFailed") },
      { status: 500 },
    );
  }
}
