import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { placeReviewSchema } from "@/lib/validations/place";
import { reviewPlace } from "@/services/places";

/** Approve a waiting spot (and its waiting photos), or send it back. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const parsed = placeReviewSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return placeInvalid(parsed.error);

    await reviewPlace({
      placeId: id,
      adminId: session.user.id,
      action: parsed.data.action,
      reason: parsed.data.action === "reject" ? parsed.data.reason : undefined,
    });
    await logAdminAction({
      adminId: session.user.id,
      action: `place_${parsed.data.action}`,
      targetType: "place",
      targetId: id,
      details: parsed.data,
    });
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      {
        data: { id },
        error: null,
        message: t(parsed.data.action === "approve" ? "approved" : "rejected"),
      },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}
