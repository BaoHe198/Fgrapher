import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { searchAuditLog } from "@/services/admin";

function parseDate(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);

    const result = await searchAuditLog({
      actorId: searchParams.get("actorId") || undefined,
      action: searchParams.get("action") || undefined,
      from: parseDate(searchParams.get("from")),
      to: parseDate(searchParams.get("to")),
      page: Math.max(1, Number(searchParams.get("page")) || 1),
    });

    return NextResponse.json(
      {
        data: result.logs,
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
      {
        data: null,
        error: "server_error",
        message: "Failed to search audit log",
      },
      { status: 500 },
    );
  }
}
