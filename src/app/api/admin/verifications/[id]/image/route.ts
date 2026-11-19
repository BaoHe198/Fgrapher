import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { getRequestIp } from "@/lib/request-meta";
import {
  getKycImageUrl,
  KycDocumentUnavailableError,
  type KycImageKind,
} from "@/services/admin";

const VALID_KINDS: KycImageKind[] = ["front", "back", "selfie", "business"];

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

    const ipAddress = getRequestIp(request);
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

    // Not a failure: a household's certificate that was never needed, or a
    // document the 90-day purge has already removed. Was a 500.
    if (err instanceof KycDocumentUnavailableError) {
      return NextResponse.json(
        {
          data: null,
          error: "not_found",
          message: t("documentNotOnFile"),
        },
        { status: 404 },
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
