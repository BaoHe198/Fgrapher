import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { HIGH_PRIORITY_REPORT_REASONS } from "@/lib/constants";
import { reportSchema } from "@/lib/validations/review";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }

    // Priority is derived server-side from the reason, never accepted from
    // the client — a reporter can't self-elevate a report's priority.
    const priority = (HIGH_PRIORITY_REPORT_REASONS as string[]).includes(parsed.data.reason)
      ? "HIGH"
      : "NORMAL";

    const report = await db.report.create({
      data: { reporterId: session.user.id, priority, ...parsed.data },
    });

    return NextResponse.json(
      { data: report, error: null, message: "Report submitted" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to submit report" },
      { status: 500 },
    );
  }
}
