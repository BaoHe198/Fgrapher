import type { Role, SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";

import {
  paymentFailedEmailHtml,
  receiptEmailHtml,
  subscriptionCancellingEmailHtml,
  subscriptionEndedEmailHtml,
  welcomeSubscriptionEmailHtml,
} from "@/lib/email";
import { db } from "@/lib/db";
import { intervalForPriceId, ROLE_PLANS } from "@/lib/constants/plans";
import { PAID_ROLES } from "@/lib/constants";
import { notifyCritical } from "@/services/notification";
import { stripe } from "@/lib/stripe";

const GRACE_PERIOD_DAYS = 7;

function billingUrl() {
  return `${process.env.NEXTAUTH_URL ?? ""}/dashboard/settings/billing`;
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "paused":
      return "CANCELLED";
    case "incomplete":
    case "incomplete_expired":
    default:
      return "EXPIRED";
  }
}

function itemForRole(subscription: Stripe.Subscription, role: Role) {
  const plan = ROLE_PLANS[role];
  if (!plan) return undefined;
  return subscription.items.data.find(
    (i) => i.price.id === plan.monthlyPriceId || i.price.id === plan.yearlyPriceId,
  );
}

// Shared by checkout.session.completed and customer.subscription.updated:
// re-derives every role's Subscription row from the live Stripe Subscription
// object, matching each SubscriptionItem to a role by price ID — a role has
// two possible prices (monthly/yearly), so this checks both (current
// period start/end live per-item on Stripe's side, not on the parent
// subscription, since API 2025-03-31).
async function syncSubscriptionFromStripe(
  userId: string,
  subscription: Stripe.Subscription,
  roles: Role[],
) {
  const results = [];

  for (const role of roles) {
    const item = itemForRole(subscription, role);
    if (!item) continue;

    const userRole = await db.userRole.upsert({
      where: { userId_role: { userId, role } },
      create: { userId, role, active: true },
      update: { active: true },
    });

    const interval = intervalForPriceId(item.price.id) ?? "month";

    const updated = await db.subscription.upsert({
      where: { userRoleId: userRole.id },
      create: {
        userRoleId: userRole.id,
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionItemId: item.id,
        stripePriceId: item.price.id,
        plan: role,
        interval,
        status: mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(item.current_period_start * 1000),
        currentPeriodEnd: new Date(item.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionItemId: item.id,
        stripePriceId: item.price.id,
        interval,
        status: mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(item.current_period_start * 1000),
        currentPeriodEnd: new Date(item.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        graceEndsAt: mapStripeStatus(subscription.status) === "PAST_DUE" ? undefined : null,
      },
    });

    results.push({ role, subscription: updated });
  }

  return results;
}

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!stripe) return;

  const userId = session.metadata?.userId;
  const rolesParam = session.metadata?.roles;
  if (!userId || !rolesParam || !session.subscription) return;

  const roles = rolesParam.split(",") as Role[];
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const results = await syncSubscriptionFromStripe(userId, stripeSubscription, roles);
  if (results.length === 0) return;

  await notifyCritical({
    userId,
    type: "SUBSCRIPTION_ACTIVE",
    title: "Welcome to Fgrapher Pro!",
    message: `Your ${results.map((r) => r.role).join(", ")} profile is now live.`,
    email: {
      subject: "Welcome to Fgrapher Pro!",
      html: welcomeSubscriptionEmailHtml({
        roleNames: results.map((r) => ROLE_PLANS[r.role]?.name ?? r.role),
        billingUrl: billingUrl(),
      }),
    },
  });
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const existing = await db.subscription.findMany({
    where: { stripeSubscriptionId: subscription.id },
    include: { userRole: true },
  });
  if (existing.length === 0) return;

  const userId = existing[0].userRole.userId;
  const roles = existing.map((s) => s.userRole.role);
  const wasCancelling = existing.some((s) => s.cancelAtPeriodEnd);

  await syncSubscriptionFromStripe(userId, subscription, roles);

  if (subscription.cancel_at_period_end && !wasCancelling) {
    const periodEnd = existing[0].currentPeriodEnd;
    await notifyCritical({
      userId,
      type: "SUBSCRIPTION_EXPIRING",
      title: "Subscription cancelling",
      message: "Your subscription is set to cancel at the end of the current period.",
      email: {
        subject: "We're sorry to see you go — Fgrapher",
        html: subscriptionCancellingEmailHtml({
          periodEndLabel: periodEnd ? periodEnd.toDateString() : "the end of the period",
          billingUrl: billingUrl(),
        }),
      },
    });
  }
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!stripe) return;

  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
  if (!subscriptionId) return;

  const existing = await db.subscription.findMany({
    where: { stripeSubscriptionId: subscriptionId },
    include: { userRole: true },
  });
  if (existing.length === 0) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const userId = existing[0].userRole.userId;
  const roles = existing.map((s) => s.userRole.role);
  await syncSubscriptionFromStripe(userId, stripeSubscription, roles);

  await db.payment.create({
    data: {
      userId,
      stripePaymentId: invoice.id ?? `invoice_${Date.now()}`,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      status: "SUCCEEDED",
      description: invoice.lines.data.map((l) => l.description).filter(Boolean).join(", ") || "Fgrapher subscription",
    },
  });

  const periodEnd = existing[0].currentPeriodEnd;
  await notifyCritical({
    userId,
    type: "SUBSCRIPTION_ACTIVE",
    title: "Payment received",
    message: `We received your payment of ${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency.toUpperCase()}.`,
    email: {
      subject: "Payment received — Fgrapher",
      html: receiptEmailHtml({
        amountLabel: `${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`,
        periodEndLabel: periodEnd ? periodEnd.toDateString() : "—",
        invoiceUrl: invoice.hosted_invoice_url ?? billingUrl(),
      }),
    },
  });
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
  if (!subscriptionId) return;

  const existing = await db.subscription.findMany({
    where: { stripeSubscriptionId: subscriptionId },
    include: { userRole: true },
  });
  if (existing.length === 0) return;

  const graceEndsAt = new Date();
  graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_PERIOD_DAYS);

  await db.subscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: "PAST_DUE", graceEndsAt },
  });

  const userId = existing[0].userRole.userId;
  await notifyCritical({
    userId,
    type: "PAYMENT_FAILED",
    title: "Payment failed",
    message: `Your card was declined. Update your payment method by ${graceEndsAt.toDateString()} to keep your profile live.`,
    email: {
      subject: "Payment failed — action needed — Fgrapher",
      html: paymentFailedEmailHtml({
        graceEndsLabel: graceEndsAt.toDateString(),
        billingUrl: billingUrl(),
      }),
    },
  });
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const existing = await db.subscription.findMany({
    where: { stripeSubscriptionId: subscription.id },
    include: { userRole: true },
  });
  if (existing.length === 0) return;

  const userId = existing[0].userRole.userId;

  await db.$transaction([
    db.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: "CANCELLED", cancelAtPeriodEnd: false },
    }),
    db.userRole.updateMany({
      where: { id: { in: existing.map((s) => s.userRoleId) } },
      data: { active: false },
    }),
    db.profile.updateMany({
      where: { userId, role: { in: existing.map((s) => s.userRole.role) } },
      data: { isPublished: false },
    }),
  ]);

  await notifyCritical({
    userId,
    type: "SUBSCRIPTION_CANCELLED",
    title: "Subscription ended",
    message: "Your subscription has ended and your profile is no longer visible in search.",
    email: {
      subject: "Your subscription has ended — Fgrapher",
      html: subscriptionEndedEmailHtml({ billingUrl: billingUrl() }),
    },
  });
}

export async function getBillingOverview(userId: string) {
  const userRoles = await db.userRole.findMany({
    where: { userId, role: { in: PAID_ROLES } },
    include: { subscription: true },
    orderBy: { createdAt: "asc" },
  });

  return userRoles;
}
