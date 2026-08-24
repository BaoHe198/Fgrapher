import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { adminUserActionSchema } from "@/lib/validations/admin";
import {
  getAdminUserDetail,
  softDeleteAdminUser,
  suspendUser,
  unsuspendUser,
  updateAdminNotes,
  verifyUser,
} from "@/services/admin";
import { assignManualPlan } from "@/services/subscription";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.admin");
  try {
    await requireAdmin();
    const { id } = await params;

    const user = await getAdminUserDetail(id);
    if (!user) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("userNotFound") },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: user, error: null, message: null },
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
      { data: null, error: "server_error", message: t("userLoadFailed") },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.admin");
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = adminUserActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidAction") },
        { status: 400 },
      );
    }

    let user;
    switch (parsed.data.action) {
      case "suspend":
        user = await suspendUser({
          userId: id,
          reason: parsed.data.reason,
          until: parsed.data.until ? new Date(parsed.data.until) : undefined,
        });
        break;
      case "unsuspend":
        user = await unsuspendUser(id);
        break;
      case "verify":
        user = await verifyUser(id);
        break;
      case "delete":
        user = await softDeleteAdminUser(id);
        break;
      case "notes":
        user = await updateAdminNotes(id, parsed.data.notes);
        break;
      case "assign_plan":
        await assignManualPlan({
          userId: id,
          role: parsed.data.role,
          plan: parsed.data.plan,
          expiresAt: new Date(parsed.data.expiresAt),
        });
        user = await getAdminUserDetail(id);
        break;
    }

    await logAdminAction({
      adminId: session.user.id,
      action: parsed.data.action,
      targetType: "user",
      targetId: id,
      details: parsed.data,
    });

    return NextResponse.json(
      { data: user, error: null, message: t("updated") },
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
      { data: null, error: "server_error", message: t("userUpdateFailed") },
      { status: 500 },
    );
  }
}
