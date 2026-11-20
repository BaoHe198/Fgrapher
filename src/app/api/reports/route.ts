import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { LOCKED_TRANSACTION, lockInTransaction } from "@/lib/db-lock";
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
    const priority = (HIGH_PRIORITY_REPORT_REASONS as string[]).includes(
      parsed.data.reason,
    )
      ? "HIGH"
      : "NORMAL";

    // One open report per reporter per target. Reporting the same profile
    // again used to add a duplicate row to the moderation queue; now it
    // updates the open one with the latest reason and details, and can only
    // raise its priority, never lower it.
    // Looked up and written under one lock — otherwise a double press on
    // "Gửi báo cáo" finds nothing twice and files the duplicates this rule
    // exists to prevent.
    const reporterId = session.user.id;
    const { existing, report } = await db.$transaction(async (tx) => {
      await lockInTransaction(
        tx,
        `report:${reporterId}:${parsed.data.targetType}:${parsed.data.targetId}`,
      );
      const existing = await tx.report.findFirst({
        where: {
          reporterId,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          status: { in: ["PENDING", "REVIEWING"] },
        },
        select: { id: true, priority: true },
      });
      const report = existing
        ? await tx.report.update({
            where: { id: existing.id },
            data: {
              reason: parsed.data.reason,
              description: parsed.data.description,
              priority: existing.priority === "HIGH" ? "HIGH" : priority,
            },
          })
        : await tx.report.create({
            data: { reporterId, priority, ...parsed.data },
          });
      return { existing, report };
    }, LOCKED_TRANSACTION);

    return NextResponse.json(
      { data: report, error: null, message: "Report submitted" },
      { status: existing ? 200 : 201 },
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
