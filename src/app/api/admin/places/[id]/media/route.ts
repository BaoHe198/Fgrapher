import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { placeMediaModerationSchema } from "@/lib/validations/place";
import {
  adminAddPlacePhotos,
  moderatePlaceMedia,
  setPlaceCover,
} from "@/services/places";

/** A spot's photos: approve, reject, choose the cover, or add more. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const parsed = placeMediaModerationSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return placeInvalid(parsed.error);
    const input = parsed.data;

    if (input.action === "cover") {
      await setPlaceCover(id, input.mediaId);
    } else if (input.action === "add") {
      await adminAddPlacePhotos(id, session.user.id, input.photos);
    } else {
      await moderatePlaceMedia({
        placeId: id,
        adminId: session.user.id,
        mediaIds: input.mediaIds,
        action: input.action,
        note: input.action === "reject" ? input.note : undefined,
      });
    }
    await logAdminAction({
      adminId: session.user.id,
      action: `place_media_${input.action}`,
      targetType: "place",
      targetId: id,
      details:
        input.action === "add"
          ? { photos: input.photos.length }
          : input.action === "cover"
            ? { mediaId: input.mediaId }
            : { mediaIds: input.mediaIds },
    });
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      { data: { id }, error: null, message: t("photosUpdated") },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}
