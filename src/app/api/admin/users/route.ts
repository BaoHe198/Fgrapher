import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { listAdminUsers } from "@/services/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);

    const result = await listAdminUsers({
      search: searchParams.get("search") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      page: Math.max(1, Number(searchParams.get("page")) || 1),
    });

    return NextResponse.json(
      {
        data: result.users,
        error: null,
        message: null,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
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
      { data: null, error: "server_error", message: "Failed to load users" },
      { status: 500 },
    );
  }
}
