import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { listDataRequests } from "@/services/admin";

const VALID_TYPES = ["EXPORT", "DELETION"] as const;
const VALID_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
] as const;

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);

    const typeParam = searchParams.get("type")?.toUpperCase();
    const type = VALID_TYPES.includes(typeParam as (typeof VALID_TYPES)[number])
      ? (typeParam as (typeof VALID_TYPES)[number])
      : undefined;

    const statusParam = searchParams.get("status")?.toUpperCase();
    const status = VALID_STATUSES.includes(
      statusParam as (typeof VALID_STATUSES)[number],
    )
      ? (statusParam as (typeof VALID_STATUSES)[number])
      : undefined;

    const result = await listDataRequests({
      type,
      status,
      page: Math.max(1, Number(searchParams.get("page")) || 1),
    });

    return NextResponse.json(
      {
        data: result.requests,
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
        message: "Failed to load data requests",
      },
      { status: 500 },
    );
  }
}
