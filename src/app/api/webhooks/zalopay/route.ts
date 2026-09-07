import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { features } from "@/lib/features";
import { isZalopayConfigured } from "@/lib/zalopay";
import { confirmZalopayPayment, PaymentError } from "@/services/payments";

// Server-to-server from ZaloPay — no requireAuth, the mac check inside
// confirmZalopayPayment IS the auth. ZaloPay's callback body is
// { data: "<raw JSON string>", mac, type } — request.json() is safe
// here (it only parses the outer envelope; `data`'s string VALUE, which
// is what the mac actually covers, comes through untouched).
export async function POST(request: Request) {
  if (!features.zalopayEnabled) {
    return NextResponse.json(
      { return_code: -1, return_message: "not_found" },
      { status: 404 },
    );
  }
  if (!isZalopayConfigured()) {
    return NextResponse.json(
      { return_code: -1, return_message: "not_configured" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    data?: string;
    mac?: string;
  } | null;
  if (!body?.data || !body.mac) {
    return NextResponse.json(
      { return_code: -1, return_message: "missing_fields" },
      { status: 400 },
    );
  }

  try {
    await confirmZalopayPayment(body.data, body.mac);
  } catch (err) {
    if (err instanceof PaymentError && err.message === "invalid_signature") {
      // ZaloPay's own convention: return_code 0/negative asks them to
      // retry delivery — appropriate for our own transient errors, but
      // an invalid mac will never become valid on retry, so this is the
      // one case answered as "received, don't retry" despite rejecting it.
      return NextResponse.json(
        { return_code: 1, return_message: "invalid_mac" },
        { status: 200 },
      );
    }
    // Same reasoning as the MoMo webhook route — deliberately caught, so
    // captured explicitly rather than relying on onRequestError.
    Sentry.captureException(err);
    return NextResponse.json(
      { return_code: 0, return_message: "internal_error" },
      { status: 200 },
    );
  }

  return NextResponse.json({ return_code: 1, return_message: "success" });
}
