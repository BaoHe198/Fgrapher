import crypto from "node:crypto";

import type { PaymentProvider, Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { bookingEmailShell, receiptEmailHtml } from "@/lib/email";
import { db } from "@/lib/db";
import {
  buildAppTransId,
  createZalopayOrder,
  verifyZalopayCallback,
} from "@/lib/zalopay";
import {
  createMomoPayment,
  verifyMomoIpnSignature,
  type MomoIpnPayload,
} from "@/lib/momo";
import type { ZalopayCallbackData } from "@/lib/zalopay";
import { generateTransferReference } from "@/lib/bank-transfer";
import { formatCurrency } from "@/lib/utils";
import { type BillingInterval, ROLE_PLANS } from "@/lib/constants/plans";
import { notifyCritical } from "@/services/notification";

export class PaymentError extends Error {}

function billingUrl() {
  return `${process.env.NEXTAUTH_URL ?? ""}/dashboard/settings/billing`;
}

// No request/cookie context in a webhook/cron/admin-action call — defaults
// to Vietnamese (CLAUDE.md rule 10), matching services/subscription.ts's
// identical webhook-handler functions.
function getEmailT() {
  return getTranslations({ locale: "vi", namespace: "libServices.email" });
}

function amountForRole(role: Role, interval: BillingInterval) {
  const rolePlan = ROLE_PLANS[role];
  if (!rolePlan) throw new PaymentError("no_plan_for_role");
  return interval === "year" ? rolePlan.yearly : rolePlan.monthly;
}

function periodEndFor(interval: BillingInterval) {
  const end = new Date();
  if (interval === "year") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

// Short, url-safe, unique enough for a per-payment order id — this is
// NOT a security token (the actual security boundary is each provider's
// signature verification), just a correlation id we hand to MoMo/ZaloPay
// and get back unchanged in their IPN/callback.
function generateOrderId() {
  return crypto.randomBytes(12).toString("hex");
}

// The one place a PENDING/AWAITING_REVIEW Payment ever becomes a live
// role — every rail below (MoMo IPN, ZaloPay callback, admin bank-
// transfer approval) funnels through this, so "money in" and "role
// activated" can never drift apart between the four payment methods.
// Same two writes as services/subscription.ts's assignManualPlan
// (UserRole → active: true, Subscription upsert) — not wrapped in a
// db.$transaction, matching assignManualPlan's own existing precedent
// (sequential awaits) rather than introducing a stricter guarantee only
// for the new rails.
async function activateRoleFromPayment({
  paymentId,
  userId,
  role,
  interval,
}: {
  paymentId: string;
  userId: string;
  role: Role;
  interval: BillingInterval;
}) {
  const expiresAt = periodEndFor(interval);

  const userRole = await db.userRole.upsert({
    where: { userId_role: { userId, role } },
    create: { userId, role, active: true },
    update: { active: true },
  });

  await db.subscription.upsert({
    where: { userRoleId: userRole.id },
    create: {
      userRoleId: userRole.id,
      plan: role,
      interval,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: expiresAt,
    },
    update: {
      plan: role,
      interval,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: expiresAt,
      cancelAtPeriodEnd: false,
    },
  });

  const payment = await db.payment.update({
    where: { id: paymentId },
    data: { status: "SUCCEEDED" },
  });

  const [roleT, emailT] = await Promise.all([
    getTranslations("role"),
    getEmailT(),
  ]);
  const amountLabel = formatCurrency(payment.amount);

  await notifyCritical({
    userId,
    type: "SUBSCRIPTION_ACTIVE",
    title: emailT("receipt.heading"),
    message: emailT("receipt.body", {
      amountLabel,
      periodEndLabel: expiresAt.toLocaleDateString("vi-VN"),
    }),
    data: { paymentId, role },
    email: {
      subject: emailT("receipt.heading"),
      html: receiptEmailHtml({
        t: emailT,
        amountLabel,
        periodEndLabel: expiresAt.toLocaleDateString("vi-VN"),
        invoiceUrl: billingUrl(),
      }),
    },
  });

  return { userRole, payment, roleLabel: roleT(role) };
}

// Distinct from Stripe's paymentFailedEmailHtml (a card-decline template
// — "your profile stays active until your grace period ends") — that
// copy doesn't fit a rejected bank-transfer submission at all, which
// usually means the role was never activated in the first place. Own
// dedicated content instead, same bookingEmailShell wrapper role-change-
// requests.ts's rejection notice already uses for the same reason.
async function notifyBankTransferRejected(userId: string, reason?: string) {
  const emailT = await getEmailT();
  const body = reason
    ? emailT("paymentRejected.bodyWithReason", { reason })
    : emailT("paymentRejected.body");

  await notifyCritical({
    userId,
    type: "PAYMENT_FAILED",
    title: emailT("paymentRejected.heading"),
    message: body,
    email: {
      subject: emailT("paymentRejected.heading"),
      html: bookingEmailShell({
        t: emailT,
        heading: emailT("paymentRejected.heading"),
        body: reason
          ? emailT("paymentRejected.bodyWithReason", {
              reason: `<strong>${reason}</strong>`,
            })
          : emailT("paymentRejected.body"),
        ctaLabel: emailT("paymentRejected.cta"),
        ctaUrl: billingUrl(),
      }),
    },
  });
}

// ---------------------------------------------------------------------
// MoMo
// ---------------------------------------------------------------------

export async function createMomoPaymentIntent(
  userId: string,
  role: Role,
  interval: BillingInterval,
) {
  const amount = amountForRole(role, interval);
  const orderId = generateOrderId();
  const roleT = await getTranslations("role");

  const payment = await db.payment.create({
    data: {
      userId,
      role,
      interval,
      provider: "MOMO",
      providerOrderId: orderId,
      amount,
      currency: "VND",
      status: "PENDING",
      description: `Fgrapher — ${roleT(role)} (${interval === "year" ? "năm" : "tháng"})`,
    },
  });

  const result = await createMomoPayment({
    orderId,
    amount,
    orderInfo: payment.description ?? "Fgrapher subscription",
    redirectUrl: `${billingUrl()}?momo=return`,
    ipnUrl: `${process.env.NEXTAUTH_URL ?? ""}/api/webhooks/momo`,
  });

  if (result.resultCode !== 0 || !result.payUrl) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    throw new PaymentError(result.message || "momo_create_failed");
  }

  return { payUrl: result.payUrl };
}

// Verifies the IPN signature FIRST — an unverified payload is never
// trusted for anything below, including which Payment row to touch.
// Idempotent: MoMo retries IPN delivery on timeout/non-2xx, so a second
// delivery for an already-resolved payment is a deliberate no-op rather
// than a duplicate role activation.
export async function confirmMomoPayment(payload: MomoIpnPayload) {
  if (!verifyMomoIpnSignature(payload)) {
    throw new PaymentError("invalid_signature");
  }

  const payment = await db.payment.findUnique({
    where: { providerOrderId: payload.orderId },
  });
  if (!payment || payment.provider !== "MOMO") {
    throw new PaymentError("payment_not_found");
  }
  if (payment.status !== "PENDING") return payment; // already resolved

  if (payload.resultCode !== 0) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        providerTransactionId: String(payload.transId),
      },
    });
    return payment;
  }

  // Defense in depth beyond signature verification — a valid signature
  // over an unexpected amount (e.g. a stale/replayed payload for a
  // orderId whose Payment row's amount was somehow different) still
  // shouldn't silently activate a role for the wrong price.
  if (payload.amount !== payment.amount || !payment.role || !payment.interval) {
    throw new PaymentError("amount_mismatch");
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { providerTransactionId: String(payload.transId) },
  });

  await activateRoleFromPayment({
    paymentId: payment.id,
    userId: payment.userId,
    role: payment.role,
    interval: payment.interval as BillingInterval,
  });

  return payment;
}

// ---------------------------------------------------------------------
// ZaloPay
// ---------------------------------------------------------------------

export async function createZalopayPaymentIntent(
  userId: string,
  role: Role,
  interval: BillingInterval,
) {
  const amount = amountForRole(role, interval);
  const orderId = generateOrderId();
  const appTransId = buildAppTransId(orderId);
  const roleT = await getTranslations("role");
  const description = `Fgrapher — ${roleT(role)} (${interval === "year" ? "năm" : "tháng"})`;

  const payment = await db.payment.create({
    data: {
      userId,
      role,
      interval,
      provider: "ZALOPAY",
      providerOrderId: appTransId,
      amount,
      currency: "VND",
      status: "PENDING",
      description,
    },
  });

  const result = await createZalopayOrder({
    appTransId,
    amount,
    appUser: userId,
    description,
    callbackUrl: `${process.env.NEXTAUTH_URL ?? ""}/api/webhooks/zalopay`,
    redirectUrl: `${billingUrl()}?zalopay=return`,
  });

  if (result.return_code !== 1 || !result.order_url) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    throw new PaymentError(result.return_message || "zalopay_create_failed");
  }

  return { payUrl: result.order_url };
}

// Same shape as confirmMomoPayment — verify signature over the RAW data
// string first, only then parse/trust it.
export async function confirmZalopayPayment(rawData: string, mac: string) {
  if (!verifyZalopayCallback(rawData, mac)) {
    throw new PaymentError("invalid_signature");
  }

  const data = JSON.parse(rawData) as ZalopayCallbackData;

  const payment = await db.payment.findUnique({
    where: { providerOrderId: data.app_trans_id },
  });
  if (!payment || payment.provider !== "ZALOPAY") {
    throw new PaymentError("payment_not_found");
  }
  if (payment.status !== "PENDING") return payment; // already resolved

  // ZaloPay only calls this callback on success — failures/cancellations
  // never reach it at all (unlike MoMo's resultCode), so there's no
  // separate failure branch to handle here.
  if (data.amount !== payment.amount || !payment.role || !payment.interval) {
    throw new PaymentError("amount_mismatch");
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { providerTransactionId: String(data.zp_trans_id) },
  });

  await activateRoleFromPayment({
    paymentId: payment.id,
    userId: payment.userId,
    role: payment.role,
    interval: payment.interval as BillingInterval,
  });

  return payment;
}

// ---------------------------------------------------------------------
// Bank transfer — manual, admin-confirmed
// ---------------------------------------------------------------------

// Two-phase, mirroring MoMo/ZaloPay's create-intent-then-confirm shape:
// the reference code has to exist and be shown to the customer BEFORE
// they make the transfer (it's what they put in the transfer's message
// so an admin can match it against a bank statement afterward) — it
// can't be generated only once they submit proof, or there'd be nothing
// for them to have written down.
export async function createBankTransferIntent(
  userId: string,
  role: Role,
  interval: BillingInterval,
) {
  const amount = amountForRole(role, interval);
  const roleT = await getTranslations("role");

  return db.payment.create({
    data: {
      userId,
      role,
      interval,
      provider: "BANK_TRANSFER",
      providerOrderId: generateTransferReference(),
      amount,
      currency: "VND",
      status: "PENDING",
      description: `Fgrapher — ${roleT(role)} (${interval === "year" ? "năm" : "tháng"})`,
    },
  });
}

// Called once the customer has actually made the transfer and uploaded
// proof — moves PENDING -> AWAITING_REVIEW, where it shows up in the
// admin queue (listPendingPayments). Scoped to the calling user's own
// payment id so one customer can't submit proof onto another's intent.
export async function submitBankTransferProof(
  userId: string,
  paymentId: string,
  proofUrl: string,
) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (
    !payment ||
    payment.userId !== userId ||
    payment.provider !== "BANK_TRANSFER"
  ) {
    throw new PaymentError("payment_not_found");
  }
  if (payment.status !== "PENDING") {
    throw new PaymentError("already_submitted");
  }

  return db.payment.update({
    where: { id: paymentId },
    data: { status: "AWAITING_REVIEW", proofUrl },
  });
}

export async function reviewBankTransferPayment({
  paymentId,
  adminId,
  approve,
  reason,
}: {
  paymentId: string;
  adminId: string;
  approve: boolean;
  reason?: string;
}) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.provider !== "BANK_TRANSFER") {
    throw new PaymentError("payment_not_found");
  }
  if (payment.status !== "AWAITING_REVIEW") {
    throw new PaymentError("already_reviewed");
  }
  if (!payment.role || !payment.interval) {
    throw new PaymentError("missing_role_or_interval");
  }

  if (approve) {
    await db.payment.update({
      where: { id: paymentId },
      data: { reviewedBy: adminId, reviewedAt: new Date() },
    });
    await activateRoleFromPayment({
      paymentId,
      userId: payment.userId,
      role: payment.role,
      interval: payment.interval as BillingInterval,
    });
  } else {
    await db.payment.update({
      where: { id: paymentId },
      data: {
        status: "FAILED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });
    await notifyBankTransferRejected(payment.userId, reason);
  }

  return db.payment.findUniqueOrThrow({ where: { id: paymentId } });
}

// ---------------------------------------------------------------------
// Cron jobs
// ---------------------------------------------------------------------

const RENEWAL_REMINDER_DAYS_BEFORE = 3;
// MoMo/ZaloPay only support one-time "captureWallet" payments (their own
// docs are explicit — true recurring needs a separate Tokenization API,
// not built here), and bank transfer obviously can't auto-charge. Unlike
// Stripe, none of these three rails silently renews — this is the thing
// that tells a provider it's time to pay again.
export async function sendSubscriptionRenewalReminders() {
  const from = new Date();
  from.setUTCDate(from.getUTCDate() + RENEWAL_REMINDER_DAYS_BEFORE);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);

  // stripeSubscriptionId: null excludes Stripe-backed subscriptions —
  // those get Stripe's own invoice-retry/dunning flow already (see
  // services/subscription.ts's handleInvoicePaymentFailed), a real
  // renewal reminder here would be redundant/confusing alongside it.
  const subscriptions = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      stripeSubscriptionId: null,
      currentPeriodEnd: { gte: from, lt: to },
    },
    include: { userRole: true },
  });

  const emailT = await getEmailT();

  let sent = 0;
  for (const subscription of subscriptions) {
    if (!subscription.currentPeriodEnd) continue;
    await notifyCritical({
      userId: subscription.userRole.userId,
      type: "SUBSCRIPTION_EXPIRING",
      title: emailT("subscriptionCancelling.heading"),
      message: emailT("subscriptionCancelling.body", {
        periodEndLabel:
          subscription.currentPeriodEnd.toLocaleDateString("vi-VN"),
      }),
      data: { role: subscription.userRole.role },
    });
    sent++;
  }

  return sent;
}

const PAYMENT_INTENT_EXPIRY_HOURS = 24;

// MoMo/ZaloPay intents stuck at PENDING because their IPN/callback never
// arrived (network blip, customer abandoned checkout, etc.) would
// otherwise sit forever — this keeps the admin queue's "stale PENDING"
// fallback section meaningful instead of accumulating phantom entries.
// Bank-transfer PENDING rows (not yet submitted) are deliberately left
// alone — a customer might legitimately take a few days to get to a bank
// branch before transferring.
export async function expirePaymentIntents() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - PAYMENT_INTENT_EXPIRY_HOURS);

  const result = await db.payment.updateMany({
    where: {
      status: "PENDING",
      provider: { in: ["MOMO", "ZALOPAY"] },
      createdAt: { lt: cutoff },
    },
    data: { status: "FAILED" },
  });

  return result.count;
}

// ---------------------------------------------------------------------
// Admin queue
// ---------------------------------------------------------------------

// Bank-transfer submissions awaiting review are the common case; stale
// MoMo/ZaloPay PENDING rows only show up here as a fallback (their own
// expire-payment-intents cron marks them FAILED after 24h, but this
// still surfaces them sooner if an admin wants to look) — never
// SUCCEEDED/FAILED/REFUNDED rows, this is a queue, not a ledger.
export function listPendingPayments() {
  return db.payment.findMany({
    where: {
      OR: [
        { status: "AWAITING_REVIEW" },
        {
          status: "PENDING",
          provider: { in: ["MOMO", "ZALOPAY"] as PaymentProvider[] },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, firstName: true, email: true } },
    },
  });
}
