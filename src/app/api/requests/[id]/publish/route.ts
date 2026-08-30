import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import {
  ServiceRequestError,
  publishDraftServiceRequest,
} from "@/services/service-requests";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.serviceRequests");
  try {
    const session = await requireAuth();
    const { id } = await params;
    const published = await publishDraftServiceRequest(id, session.user.id);
    return NextResponse.json(
      { data: published, error: null, message: t("published") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof ServiceRequestError) {
      return NextResponse.json(
        { data: null, error: "request_error", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("publishFailed") },
      { status: 500 },
    );
  }
}
