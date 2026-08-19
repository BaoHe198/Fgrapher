import { NextResponse } from "next/server";

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const user = await getAdminUserDetail(id);
    if (!user) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: user, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load user" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = adminUserActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Invalid action" },
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
    }

    await logAdminAction({
      adminId: session.user.id,
      action: parsed.data.action,
      targetType: "user",
      targetId: id,
      details: parsed.data,
    });

    return NextResponse.json({ data: user, error: null, message: "Updated" }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to update user" },
      { status: 500 },
    );
  }
}
