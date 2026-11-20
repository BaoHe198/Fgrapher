import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { placeMergeSchema } from "@/lib/validations/place";
import { mergePlaces } from "@/services/places";

/** Fold this (duplicate) spot into another one. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const parsed = placeMergeSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return placeInvalid(parsed.error);

    await mergePlaces(id, parsed.data.intoPlaceId);
    await logAdminAction({
      adminId: session.user.id,
      action: "place_merge",
      targetType: "place",
      targetId: id,
      details: { into: parsed.data.intoPlaceId },
    });
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      {
        data: { id: parsed.data.intoPlaceId },
        error: null,
        message: t("merged"),
      },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}
