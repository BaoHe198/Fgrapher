import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { constructWebhookEvent, isStripeConfigured } from "@/lib/stripe";
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/services/subscription";

// Stripe requires the raw request body to verify the signature — req.json()
// would parse-and-reserialize, changing the bytes and breaking verification.
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ received: false, error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ received: false, error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch {
    return NextResponse.json({ received: false, error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: Stripe retries on timeout/non-2xx, so a replayed event ID
  // must be a no-op rather than double-applying the state change.
  const existing = await db.webhookEvent.findUnique({ where: { id: event.id } });
  if (existing?.processed) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  await db.webhookEvent.upsert({
    where: { id: event.id },
    create: { id: event.id, type: event.type, payload: event.data.object as object },
    update: {},
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        break;
    }

    await db.webhookEvent.update({ where: { id: event.id }, data: { processed: true } });
  } catch (err) {
    // Still return 200 — an internal error shouldn't make Stripe retry
    // indefinitely. The error is persisted on the WebhookEvent row (left
    // unprocessed) for manual investigation; wire up Sentry here once it's
    // set up in the project.
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
