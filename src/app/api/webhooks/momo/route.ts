import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { features } from "@/lib/features";
import { isMomoConfigured, type MomoIpnPayload } from "@/lib/momo";
import { confirmMomoPayment, PaymentError } from "@/services/payments";

// Server-to-server from MoMo — no requireAuth, the signature check
// inside confirmMomoPayment IS the auth. Unlike Stripe's webhook route,
// MoMo's signature is a field embedded in the JSON body itself (not an
// HTTP header over the raw byte stream), so request.json() is safe here
// — no raw-body preservation needed.
export async function POST(request: Request) {
  if (!features.momoEnabled) {
    return NextResponse.json({ received: false }, { status: 404 });
  }
  if (!isMomoConfigured()) {
    return NextResponse.json({ received: false }, { status: 503 });
  }

  const payload = (await request
    .json()
    .catch(() => null)) as MomoIpnPayload | null;
  if (!payload) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  try {
    await confirmMomoPayment(payload);
  } catch (err) {
    // An invalid signature is an expected/anticipated rejection (bad
    // actor probing, or a real config mismatch) — reported as a 400, not
    // sent to Sentry as an application error.
    if (err instanceof PaymentError && err.message === "invalid_signature") {
      return NextResponse.json({ received: false }, { status: 400 });
    }
    // Everything else (payment_not_found, amount_mismatch, a DB hiccup)
    // IS worth knowing about — captured explicitly rather than relying
    // on Next's onRequestError instrumentation, which only fires on an
    // UNCAUGHT exception and this one is deliberately caught so MoMo
    // still gets a 2xx and doesn't retry indefinitely (same trade-off
    // Stripe's webhook route makes).
    Sentry.captureException(err);
  }

  // MoMo expects a 204/2xx with no body to consider the IPN delivered.
  return new NextResponse(null, { status: 204 });
}
