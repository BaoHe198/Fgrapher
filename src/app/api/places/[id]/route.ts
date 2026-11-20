import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/lib/auth-helpers";
import { placeFailure, placeInvalid } from "@/lib/places/responses";
import { placeProposalSchema } from "@/lib/validations/place";
import { updatePlaceProposal, withdrawPlaceProposal } from "@/services/places";

/** The proposer edits a spot still waiting for review, or sent back. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const parsed = placeProposalSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return placeInvalid(parsed.error);

    await updatePlaceProposal(session.user.id, id, parsed.data);
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      { data: { id }, error: null, message: t("resubmitted") },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}

/** The proposer withdraws a spot that is not public yet. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await withdrawPlaceProposal(session.user.id, id);
    const t = await getTranslations("apiMessages.places");
    return NextResponse.json(
      { data: { id }, error: null, message: t("withdrawn") },
      { status: 200 },
    );
  } catch (err) {
    return placeFailure(err);
  }
}
