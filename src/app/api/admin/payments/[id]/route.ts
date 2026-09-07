import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { logAdminAction, requireAdmin } from "@/lib/admin";
import { AuthError } from "@/lib/auth-helpers";
import { reviewPaymentSchema } from "@/lib/validations/payments";
import { reviewBankTransferPayment, PaymentError } from "@/services/payments";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.admin");
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const parsed = reviewPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: t("invalidInput") },
        { status: 400 },
      );
    }

    const payment = await reviewBankTransferPayment({
      paymentId: id,
      adminId: session.user.id,
      approve: parsed.data.action === "approve",
      reason: parsed.data.action === "reject" ? parsed.data.reason : undefined,
    });

    await logAdminAction({
      adminId: session.user.id,
      action: `payment_${parsed.data.action}`,
      targetType: "payment",
      targetId: id,
      details: parsed.data,
    });

    return NextResponse.json(
      { data: payment, error: null, message: t("paymentUpdated") },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof PaymentError) {
      const message =
        err.message === "payment_not_found"
          ? t("paymentNotFound")
          : t("paymentAlreadyReviewed");
      return NextResponse.json(
        { data: null, error: err.message, message },
        { status: err.message === "payment_not_found" ? 404 : 400 },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: t("paymentUpdateFailed") },
      { status: 500 },
    );
  }
}
