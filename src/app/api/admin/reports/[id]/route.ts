import { NextResponse } from "next/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { resolveReportSchema } from "@/lib/validations/admin";
import { resolveReport } from "@/services/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = resolveReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Invalid input" },
        { status: 400 },
      );
    }

    const report = await resolveReport({ reportId: id, adminId: session.user.id, ...parsed.data });

    await logAdminAction({
      adminId: session.user.id,
      action: `report_${parsed.data.status.toLowerCase()}`,
      targetType: "report",
      targetId: id,
      details: parsed.data,
    });

    return NextResponse.json({ data: report, error: null, message: "Report updated" }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to update report" },
      { status: 500 },
    );
  }
}
