import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { listOpportunitiesForProvider } from "@/services/request-offers";

export async function GET(request: Request) {
  const t = await getTranslations("apiMessages.offers");
  try {
    const session = await requireAuth();
    const role = new URL(request.url).searchParams.get("role") as Role | null;
    if (!role) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("roleRequired") },
        { status: 400 },
      );
    }

    const opportunities = await listOpportunitiesForProvider(
      session.user.id,
      role,
    );

    return NextResponse.json(
      { data: opportunities, error: null, message: null },
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
