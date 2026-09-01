import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { listRoleChangeRequests } from "@/services/role-change-requests";

export async function GET() {
  const t = await getTranslations("apiMessages.admin");
  try {
    await requireAdmin();
    const requests = await listRoleChangeRequests({ status: "PENDING" });

    return NextResponse.json(
      { data: requests, error: null, message: null },
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
        message: t("roleChangeRequestsLoadFailed"),
      },
      { status: 500 },
    );
  }
}
