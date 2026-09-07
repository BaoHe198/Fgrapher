import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import {
  getBankTransferInfo,
  isBankTransferConfigured,
} from "@/lib/bank-transfer";
import {
  createPaymentIntentSchema,
  submitBankTransferProofSchema,
} from "@/lib/validations/payments";
import {
  createBankTransferIntent,
  submitBankTransferProof,
  PaymentError,
} from "@/services/payments";

// GET: static bank info + the caller's own submission history (so the
// billing settings page can show "đang chờ admin xác nhận" after a
// reload, not just right after submitting in the same session).
export async function GET() {
  if (!features.bankTransferEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  const t = await getTranslations("apiMessages.payments");
  try {
    const session = await requireAuth();

    if (!isBankTransferConfigured()) {
      return NextResponse.json(
        { data: null, error: "not_configured", message: t("notConfigured") },
        { status: 503 },
      );
    }

    const [bankInfo, ownSubmissions] = await Promise.all([
      getBankTransferInfo(),
      db.payment.findMany({
        where: { userId: session.user.id, provider: "BANK_TRANSFER" },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return NextResponse.json(
      {
        data: { bankInfo, submissions: ownSubmissions },
        error: null,
        message: null,
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
    return NextResponse.json(
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}

// POST: step 1 — create the intent, get back a reference code + amount
// to show the customer BEFORE they make the transfer.
export async function POST(request: Request) {
  if (!features.bankTransferEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  const t = await getTranslations("apiMessages.payments");
  try {
    const session = await requireAuth();

    if (!isBankTransferConfigured()) {
      return NextResponse.json(
        { data: null, error: "not_configured", message: t("notConfigured") },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = createPaymentIntentSchema.safeParse(body);
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

    const payment = await createBankTransferIntent(
      session.user.id,
      parsed.data.role,
      parsed.data.interval,
    );

    return NextResponse.json(
      { data: payment, error: null, message: null },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("createFailed") },
      { status: 500 },
    );
  }
}

// PATCH: step 2 — the customer has made the transfer and uploaded proof.
export async function PATCH(request: Request) {
  if (!features.bankTransferEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  const t = await getTranslations("apiMessages.payments");
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = submitBankTransferProofSchema.safeParse(body);
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

    const payment = await submitBankTransferProof(
      session.user.id,
      parsed.data.paymentId,
      parsed.data.proofUrl,
    );

    return NextResponse.json(
      { data: payment, error: null, message: t("bankTransferSubmitted") },
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
      return NextResponse.json(
        { data: null, error: err.message, message: t("createFailed") },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: t("createFailed") },
      { status: 500 },
    );
  }
}
