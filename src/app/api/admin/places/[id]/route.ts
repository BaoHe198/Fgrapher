import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { adminPlaceUpdateSchema } from "@/lib/validations/place";
import { adminUpdatePlace, deletePlace } from "@/services/places";

/** An admin edits a spot's facts, its open/closed state, or re-checks it. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const parsed = adminPlaceUpdateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return placeInvalid(parsed.error);

    await adminUpdatePlace(id, parsed.data);
    await logAdminAction({
      adminId: session.user.id,
      action: "place_update",
      targetType: "place",
      targetId: id,
      details: { fields: Object.keys(parsed.data) },
    });
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      { data: { id }, error: null, message: t("updated") },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    await deletePlace(id);
    await logAdminAction({
      adminId: session.user.id,
      action: "place_delete",
      targetType: "place",
      targetId: id,
    });
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      { data: { id }, error: null, message: t("deleted") },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}
