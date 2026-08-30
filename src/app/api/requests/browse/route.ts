import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { PROVIDER_ROLES } from "@/lib/constants";
import { listBrowsableRequests } from "@/services/service-requests";

export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.serviceRequests");
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");
    const role =
      roleParam && PROVIDER_ROLES.includes(roleParam as Role)
        ? (roleParam as Role)
        : undefined;
    const provinceId = searchParams.get("provinceId") ?? undefined;
    const wardId = searchParams.get("wardId") ?? undefined;

    const requests = await listBrowsableRequests({ role, provinceId, wardId });

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
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}
