import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  exportUserData,
  logAudit,
  requestDataExport,
} from "@/services/compliance";

// Synchronous export — the underlying queries are cheap at this app's
// current scale, so there's no async job queue. Still logged as a
// DataRequest (immediately COMPLETED) so it shows up in the admin
// compliance page's history, matching the DELETION request's own trail.
export async function POST() {
  try {
    const session = await requireAuth();

    const dataRequest = await requestDataExport(session.user.id);
    const data = await exportUserData(session.user.id);
    await db.dataRequest.update({
      where: { id: dataRequest.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await logAudit({
      actorId: session.user.id,
      action: "DATA_EXPORT",
      targetType: "user",
      targetId: session.user.id,
    });

    return NextResponse.json(
      { data, error: null, message: null },
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
      { data: null, error: "server_error", message: "Failed to export data" },
      { status: 500 },
    );
  }
}
