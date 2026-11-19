import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { logAudit, requestDeletion } from "@/services/compliance";

// Creates a DataRequest rather than deleting immediately — an admin
// processes it (see services/compliance.ts's processDeletion and the
// /admin/compliance queue), which is what actually anonymizes the User
// row and hard-deletes owned content.
export async function POST() {
  // These three answers were hardcoded English; the settings page shows the
  // failure one to the user as it comes.
  const t = await getTranslations("apiMessages.users");
  try {
    const session = await requireAuth();

    const pending = await db.dataRequest.findFirst({
      where: {
        userId: session.user.id,
        type: "DELETION",
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });
    if (pending) {
      return NextResponse.json(
        {
          data: pending,
          error: null,
          message: t("deletionAlreadyPending"),
        },
        { status: 200 },
      );
    }

    const dataRequest = await requestDeletion(session.user.id);
    await logAudit({
      actorId: session.user.id,
      action: "ACCOUNT_DELETION_REQUESTED",
      targetType: "user",
      targetId: session.user.id,
    });

    return NextResponse.json(
      {
        data: dataRequest,
        error: null,
        message: t("deletionSubmitted"),
      },
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
      {
        data: null,
        error: "server_error",
        message: t("deletionFailed"),
      },
      { status: 500 },
    );
  }
}
