import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { processDataRequestSchema } from "@/lib/validations/admin";
import { processDataRequest } from "@/services/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.admin");
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = processDataRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    const dataRequest = await processDataRequest({
      id,
      action: parsed.data.action,
      note: parsed.data.action === "reject" ? parsed.data.note : undefined,
    });

    await logAdminAction({
      adminId: session.user.id,
      action: `data_request_${parsed.data.action}`,
      targetType: "data_request",
      targetId: id,
      details: parsed.data,
    });

    return NextResponse.json(
      { data: dataRequest, error: null, message: t("dataRequestUpdated") },
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
        message: t("dataRequestProcessFailed"),
      },
      { status: 500 },
    );
  }
}
