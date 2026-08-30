import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { OfferError, declineOffer } from "@/services/request-offers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.offers");
  try {
    const session = await requireAuth();
    const { id } = await params;
    await declineOffer(id, session.user.id);
    return NextResponse.json(
      { data: null, error: null, message: t("offerDeclined") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof OfferError) {
      return NextResponse.json(
        { data: null, error: "offer_error", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("declineFailed") },
      { status: 500 },
    );
  }
}
