import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { createOfferSchema } from "@/lib/validations/service-request";
import {
  OfferError,
  editOffer,
  withdrawOffer,
} from "@/services/request-offers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.offers");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const parsed = createOfferSchema.safeParse(body);
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

    const offer = await editOffer(id, session.user.id, parsed.data);

    return NextResponse.json(
      { data: offer, error: null, message: t("offerUpdated") },
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
      { data: null, error: "server_error", message: t("offerUpdateFailed") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.offers");
  try {
    const session = await requireAuth();
    const { id } = await params;
    await withdrawOffer(id, session.user.id);
    return NextResponse.json(
      { data: null, error: null, message: t("offerWithdrawn") },
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
      { data: null, error: "server_error", message: t("offerWithdrawFailed") },
      { status: 500 },
    );
  }
}
