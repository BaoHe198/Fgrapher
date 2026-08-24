import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { returnRentalSchema } from "@/lib/validations/marketplace";
import { markRentalReturned, OrderError } from "@/services/orders";

// Dormant while MARKETPLACE_ENABLED=false — see CLAUDE.md.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.orders");
  if (!features.marketplaceEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: t("notFound") },
      { status: 404 },
    );
  }

  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const parsed = returnRentalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    const order = await markRentalReturned(
      id,
      session.user.id,
      parsed.data.deductDeposit,
      parsed.data.note,
    );

    return NextResponse.json(
      { data: order, error: null, message: t("rentalReturned") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof OrderError) {
      return NextResponse.json(
        { data: null, error: "order_error", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: t("rentalReturnFailed"),
      },
      { status: 500 },
    );
  }
}
