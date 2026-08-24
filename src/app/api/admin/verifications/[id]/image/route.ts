import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { getKycImageUrl, type KycImageKind } from "@/services/admin";

const VALID_KINDS: KycImageKind[] = ["front", "back", "selfie"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.admin");
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");

    if (!kind || !VALID_KINDS.includes(kind as KycImageKind)) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: t("invalidKycKind"),
        },
        { status: 400 },
      );
    }

    const ipAddress = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    const url = await getKycImageUrl({
      userRoleId: id,
      kind: kind as KycImageKind,
      adminId: session.user.id,
      ipAddress,
    });

    return NextResponse.json(
      { data: { url }, error: null, message: null },
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
      {
        data: null,
        error: "server_error",
        message: t("documentLinkFailed"),
      },
      { status: 500 },
    );
  }
}
