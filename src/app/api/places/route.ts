import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/lib/auth-helpers";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { placeProposalSchema } from "@/lib/validations/place";
import { proposePlace } from "@/services/places";

/** A verified provider (or an admin) proposes a photo spot. */
export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const parsed = placeProposalSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return placeInvalid(parsed.error);

    const place = await proposePlace(session.user.id, parsed.data);
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      { data: { id: place.id }, error: null, message: t("proposed") },
      { status: 201 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}
