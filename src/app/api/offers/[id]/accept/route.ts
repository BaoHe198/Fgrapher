import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { acceptOfferSchema } from "@/lib/validations/service-request";
import { OfferError, acceptOffer } from "@/services/request-offers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.offers");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = acceptOfferSchema.safeParse(body);
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

    const booking = await acceptOffer(id, session.user.id, parsed.data);

    return NextResponse.json(
      { data: booking, error: null, message: t("offerAccepted") },
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
      { data: null, error: "server_error", message: t("acceptFailed") },
      { status: 500 },
    );
  }
}
