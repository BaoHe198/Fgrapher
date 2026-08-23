import Stripe from "stripe";

// Dormant while BILLING_ENABLED=false (src/lib/features.ts) — Stripe
// can't take a merchant account for a Vietnam-registered business, see
// CLAUDE.md's "Ràng buộc bắt buộc" #1. Every call site in
// src/app/api/stripe/*, src/app/api/webhooks/stripe, and
// services/subscription.ts's Stripe-syncing functions is gated behind
// that flag and returns 404 without reaching this file. Kept, not
// deleted, in case the business situation changes (e.g. incorporating
// abroad) — re-enable by setting BILLING_ENABLED=true and configuring
// real Stripe credentials; no code changes needed to turn it back on.
//
// No-ops gracefully when STRIPE_SECRET_KEY isn't configured (this
// environment has no live Stripe credentials), matching the pattern
// already used for Cloudinary/Resend — callers check isStripeConfigured()
// or catch StripeNotConfiguredError rather than crash.
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export function isStripeConfigured() {
  return Boolean(stripe);
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe isn't configured in this environment");
    this.name = "StripeNotConfiguredError";
  }
}

function requireStripe() {
  if (!stripe) throw new StripeNotConfiguredError();
  return stripe;
}

export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string | null,
) {
  const client = requireStripe();

  const existing = await client.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0];

  return client.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  });
}

export async function createCheckoutSession({
  customerId,
  lineItems,
  metadata,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  lineItems: { price: string; quantity: number }[];
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}) {
  const client = requireStripe();

  return client.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    subscription_data: { trial_period_days: 14, metadata },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    allow_promotion_codes: true,
  });
}

// Stripe's zero-decimal currencies (VND included) expect the amount as-is,
// not multiplied by 100 like USD/EUR cents — getting this wrong overcharges
// VND customers 100x.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "vnd",
  "jpy",
  "krw",
  "clp",
  "vuv",
  "xof",
  "xaf",
]);

export function toStripeAmount(amount: number, currency: string) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

export async function createOrderCheckoutSession({
  customerEmail,
  lineItems,
  metadata,
  successUrl,
  cancelUrl,
  collectShippingAddress,
}: {
  customerEmail: string;
  lineItems: {
    name: string;
    amount: number;
    currency: string;
    quantity: number;
  }[];
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  collectShippingAddress: boolean;
}) {
  const client = requireStripe();

  return client.checkout.sessions.create({
    customer_email: customerEmail,
    mode: "payment",
    line_items: lineItems.map((item) => ({
      price_data: {
        currency: item.currency.toLowerCase(),
        product_data: { name: item.name },
        unit_amount: toStripeAmount(item.amount, item.currency),
      },
      quantity: item.quantity,
    })),
    ...(collectShippingAddress
      ? { shipping_address_collection: { allowed_countries: ["VN", "US"] } }
      : {}),
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function refundPayment(paymentIntentId: string) {
  const client = requireStripe();
  return client.refunds.create({ payment_intent: paymentIntentId });
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
) {
  const client = requireStripe();
  return client.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean,
) {
  const client = requireStripe();
  if (immediately) return client.subscriptions.cancel(subscriptionId);
  return client.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function resumeSubscription(subscriptionId: string) {
  const client = requireStripe();
  return client.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export function constructWebhookEvent(rawBody: string, signature: string) {
  const client = requireStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new StripeNotConfiguredError();
  return client.webhooks.constructEvent(rawBody, signature, secret);
}

export { stripe };
