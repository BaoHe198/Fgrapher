import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { getAdminStats, getRecentActivity } from "@/services/admin";

export async function GET() {
  try {
    await requireAdmin();

    const [stats, activity] = await Promise.all([getAdminStats(), getRecentActivity()]);

    return NextResponse.json({ data: { stats, activity }, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load admin stats" },
      { status: 500 },
    );
  }
}
