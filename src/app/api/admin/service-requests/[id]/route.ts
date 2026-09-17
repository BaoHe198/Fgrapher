import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { reviewServiceRequestSchema } from "@/lib/validations/admin";
import {
  reviewServiceRequest,
  ServiceRequestReviewError,
} from "@/services/service-requests";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.admin");
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const parsed = reviewServiceRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    const reviewed = await reviewServiceRequest({
      requestId: id,
      action: parsed.data.action,
      reason: parsed.data.action === "reject" ? parsed.data.reason : undefined,
    });

    await logAdminAction({
      adminId: session.user.id,
      action: `service_request_${parsed.data.action}`,
      targetType: "service_request",
      targetId: id,
      details: parsed.data,
    });

    return NextResponse.json(
      {
        data: reviewed,
        error: null,
        message: t("serviceRequestReviewed"),
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof ServiceRequestReviewError) {
      return NextResponse.json(
        {
          data: null,
          error: err.message,
          message:
            err.message === "not_found"
              ? t("serviceRequestNotFound")
              : t("serviceRequestAlreadyReviewed"),
        },
        { status: err.status },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: t("serviceRequestReviewFailed"),
      },
      { status: 500 },
    );
  }
}
