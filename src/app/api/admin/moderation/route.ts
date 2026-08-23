import { NextResponse } from "next/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { moderateMediaSchema } from "@/lib/validations/admin";
import { listPendingMedia, moderateMedia } from "@/services/admin";

export async function GET() {
  try {
    await requireAdmin();
    const media = await listPendingMedia();

    return NextResponse.json(
      { data: media, error: null, message: null },
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
        message: "Failed to load moderation queue",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const parsed = moderateMediaSchema.safeParse(body);
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

    const count = await moderateMedia({
      mediaIds: parsed.data.mediaIds,
      adminId: session.user.id,
      action: parsed.data.action,
      reason: parsed.data.action === "reject" ? parsed.data.reason : undefined,
    });

    await logAdminAction({
      adminId: session.user.id,
      action: `media_${parsed.data.action}`,
      targetType: "profile_media",
      targetId: parsed.data.mediaIds.join(","),
      details: parsed.data,
    });

    return NextResponse.json(
      { data: { count }, error: null, message: "Moderation updated" },
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
        message: "Failed to update moderation",
      },
      { status: 500 },
    );
  }
}
