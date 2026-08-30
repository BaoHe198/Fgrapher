import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { listProviderOffers } from "@/services/request-offers";

export async function GET() {
  const t = await getTranslations("apiMessages.offers");
  try {
    const session = await requireAuth();
    const offers = await listProviderOffers(session.user.id);
    return NextResponse.json(
      { data: offers, error: null, message: null },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}
