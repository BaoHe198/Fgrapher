import { NextResponse } from "next/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { reviewVerificationSchema } from "@/lib/validations/admin";
import { reviewVerification } from "@/services/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = reviewVerificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Invalid input" },
        { status: 400 },
      );
    }

    const userRole = await reviewVerification({
      userRoleId: id,
      adminId: session.user.id,
      approve: parsed.data.action === "approve",
      reason: parsed.data.action === "reject" ? parsed.data.reason : undefined,
    });

    await logAdminAction({
      adminId: session.user.id,
      action: `verification_${parsed.data.action}`,
      targetType: "user_role",
      targetId: id,
      details: parsed.data,
    });

    return NextResponse.json(
      { data: userRole, error: null, message: "Verification updated" },
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
        message: "Failed to update verification",
      },
      { status: 500 },
    );
  }
}
