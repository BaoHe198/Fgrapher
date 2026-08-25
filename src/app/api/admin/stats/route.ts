import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { getAdminStats, getRecentActivity } from "@/services/admin";

export async function GET() {
  const t = await getTranslations("apiMessages.admin");
  try {
    await requireAdmin();

    const activityT = await getTranslations(
      "accountFlows.admin.overview.activity",
    );
    const [stats, activity] = await Promise.all([
      getAdminStats(),
      getRecentActivity(activityT),
    ]);

    return NextResponse.json(
      { data: { stats, activity }, error: null, message: null },
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
