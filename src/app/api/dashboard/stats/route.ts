import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { getCustomerStats, getProviderStats, isProviderRoleSet } from "@/services/dashboard";

export async function GET() {
  try {
    const session = await requireAuth();

    const data = isProviderRoleSet(session.user.roles)
      ? await getProviderStats(session.user.id)
      : await getCustomerStats(session.user.id);

    return NextResponse.json({ data, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load stats" },
      { status: 500 },
    );
  }
}
