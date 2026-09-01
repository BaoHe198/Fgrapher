import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { reviewRoleChangeRequestSchema } from "@/lib/validations/admin";
import {
  reviewRoleChangeRequest,
  RoleChangeRequestError,
} from "@/services/role-change-requests";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.admin");
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = reviewRoleChangeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    const roleChangeRequest = await reviewRoleChangeRequest({
      requestId: id,
      adminId: session.user.id,
      approve: parsed.data.action === "approve",
      reason: parsed.data.action === "reject" ? parsed.data.reason : undefined,
    });

    await logAdminAction({
      adminId: session.user.id,
      action: `role_change_${parsed.data.action}`,
      targetType: "role_change_request",
      targetId: id,
      details: parsed.data,
    });

    return NextResponse.json(
      {
        data: roleChangeRequest,
        error: null,
        message: t("roleChangeRequestUpdated"),
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
    if (err instanceof RoleChangeRequestError) {
      const message =
        err.message === "not_found"
          ? t("roleChangeRequestNotFound")
          : t("roleChangeRequestAlreadyReviewed");
      return NextResponse.json(
        { data: null, error: err.message, message },
        { status: err.message === "not_found" ? 404 : 400 },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: t("roleChangeRequestUpdateFailed"),
      },
      { status: 500 },
    );
  }
}
