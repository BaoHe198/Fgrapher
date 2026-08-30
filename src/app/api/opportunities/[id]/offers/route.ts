import type { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { createOfferSchema } from "@/lib/validations/service-request";
import { OfferError, createOffer } from "@/services/request-offers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.offers");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const role = body.role as Role | undefined;
    if (!role) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("roleRequired") },
        { status: 400 },
      );
    }

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

    const offer = await createOffer(id, session.user.id, role, parsed.data);

    return NextResponse.json(
      { data: offer, error: null, message: t("offerSent") },
      { status: 201 },
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
      { data: null, error: "server_error", message: t("offerFailed") },
      { status: 500 },
    );
  }
}
