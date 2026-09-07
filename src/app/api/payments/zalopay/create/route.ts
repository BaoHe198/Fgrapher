import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { features } from "@/lib/features";
import { isZalopayConfigured } from "@/lib/zalopay";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPaymentIntentSchema } from "@/lib/validations/payments";
import { createZalopayPaymentIntent, PaymentError } from "@/services/payments";

const CREATE_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };

export async function POST(request: Request) {
  if (!features.zalopayEnabled) {
    return NextResponse.json(
      { data: null, error: "not_found", message: "Not found" },
      { status: 404 },
    );
  }

  const t = await getTranslations("apiMessages.payments");
  try {
    const session = await requireAuth();

    const rateLimit = checkRateLimit(
      `payment-create:${session.user.id}`,
      CREATE_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          data: null,
          error: "too_many_requests",
          message: t("tooManyRequests"),
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    if (!isZalopayConfigured()) {
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

    const { payUrl } = await createZalopayPaymentIntent(
      session.user.id,
      parsed.data.role,
      parsed.data.interval,
    );

    return NextResponse.json(
      { data: { payUrl }, error: null, message: null },
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
        { status: 502 },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: t("createFailed") },
      { status: 500 },
    );
  }
}
