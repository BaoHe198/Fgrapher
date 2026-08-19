import Stripe from "stripe";

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

export async function getOrCreateCustomer(userId: string, email: string, name?: string | null) {
  const client = requireStripe();

  const existing = await client.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0];

  return client.customers.create({ email, name: name ?? undefined, metadata: { userId } });
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

export async function createPortalSession(customerId: string, returnUrl: string) {
  const client = requireStripe();
  return client.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}

export async function cancelSubscription(subscriptionId: string, immediately: boolean) {
  const client = requireStripe();
  if (immediately) return client.subscriptions.cancel(subscriptionId);
  return client.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

export async function resumeSubscription(subscriptionId: string) {
  const client = requireStripe();
  return client.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
}

export function constructWebhookEvent(rawBody: string, signature: string) {
  const client = requireStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new StripeNotConfiguredError();
  return client.webhooks.constructEvent(rawBody, signature, secret);
}

export { stripe };
