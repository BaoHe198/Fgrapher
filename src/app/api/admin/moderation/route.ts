import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { AuthError } from "@/lib/auth-helpers";
import { moderateMediaSchema } from "@/lib/validations/admin";
import {
  listPendingMedia,
  listPendingProductImages,
  moderateMedia,
  moderateProductImages,
} from "@/services/admin";

export async function GET() {
  const t = await getTranslations("apiMessages.admin");
  try {
    await requireAdmin();
    // Portfolio photos and product photos live in different tables but are
    // one review job, so they come back as one queue: auto-flagged first
    // (that is what the tier-1 scan is for), then oldest first, which is
    // what the SLA badge measures against.
    const [media, productImages] = await Promise.all([
      listPendingMedia(),
      listPendingProductImages(),
    ]);

    const queue = [
      ...media.map((row) => ({ ...row, kind: "profile" as const })),
      ...productImages,
    ].sort((a, b) => {
      if (Boolean(a.autoFlagReason) !== Boolean(b.autoFlagReason)) {
        return a.autoFlagReason ? -1 : 1;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return NextResponse.json(
      { data: queue, error: null, message: null },
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

    const reason =
      parsed.data.action === "reject" ? parsed.data.reason : undefined;

    // One queue, two tables: split the selection by where each id actually
    // lives instead of trusting a client-supplied label.
    const productRows = await db.productImage.findMany({
      where: { id: { in: parsed.data.mediaIds } },
      select: { id: true },
    });
    const productIds = new Set(productRows.map((row) => row.id));
    const profileIds = parsed.data.mediaIds.filter((id) => !productIds.has(id));

    let count = 0;
    if (profileIds.length > 0) {
      count += await moderateMedia({
        mediaIds: profileIds,
        adminId: session.user.id,
        action: parsed.data.action,
        reason,
      });
    }
    if (productIds.size > 0) {
      count += await moderateProductImages({
        imageIds: [...productIds],
        adminId: session.user.id,
        action: parsed.data.action,
        reason,
      });
    }

    await logAdminAction({
      adminId: session.user.id,
      action: `media_${parsed.data.action}`,
      targetType: productIds.size > 0 ? "product_image" : "profile_media",
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
