import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { adminPlaceCreateSchema } from "@/lib/validations/place";
import { adminCreatePlace } from "@/services/places";

/**
 * An admin adds a spot directly (the starter set). It is created waiting
 * for review like any other, so publishing stays one deliberate step.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const parsed = adminPlaceCreateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return placeInvalid(parsed.error);

    const place = await adminCreatePlace(session.user.id, parsed.data);
    await logAdminAction({
      adminId: session.user.id,
      action: "place_create",
      targetType: "place",
      targetId: place.id,
      details: { name: place.name, photos: parsed.data.photos.length },
    });
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      { data: { id: place.id }, error: null, message: t("created") },
      { status: 201 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}
