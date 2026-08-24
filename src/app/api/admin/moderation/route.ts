import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { moderateMediaSchema } from "@/lib/validations/admin";
import { listPendingMedia, moderateMedia } from "@/services/admin";

export async function GET() {
  const t = await getTranslations("apiMessages.admin");
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
        message: t("moderationQueueLoadFailed"),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const t = await getTranslations("apiMessages.admin");
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const parsed = moderateMediaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? t("invalidInput"),
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
      { data: { count }, error: null, message: t("moderationUpdated") },
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
        message: t("moderationUpdateFailed"),
      },
      { status: 500 },
    );
  }
}
