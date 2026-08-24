import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import {
  getCustomerStats,
  getProviderStats,
  isProviderRoleSet,
} from "@/services/dashboard";

export async function GET() {
  const t = await getTranslations("apiMessages.dashboard");
  try {
    const session = await requireAuth();

    const data = isProviderRoleSet(session.user.roles)
      ? await getProviderStats(session.user.id)
      : await getCustomerStats(session.user.id);

    return NextResponse.json(
      { data, error: null, message: null },
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
      { data: null, error: "server_error", message: t("statsLoadFailed") },
      { status: 500 },
    );
  }
}
