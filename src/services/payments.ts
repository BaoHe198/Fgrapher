import crypto from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import type { Payment, PaymentProvider, Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import {
  bookingEmailShell,
  receiptEmailHtml,
  subscriptionEndedEmailHtml,
} from "@/lib/email";
import { revalidatePublicProfile } from "@/lib/cache";
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
import { PAID_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";
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

function periodEndFrom(base: Date, interval: BillingInterval) {
  const end = new Date(base);
  if (interval === "year") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

// Same one-active-paid-role-per-account rule /api/users/roles and
// createRoleChangeRequest already enforce (CLAUDE.md) — checked here too
// because these 3 create-intent functions are a second, independent path
// that can activate a role, and previously validated nothing beyond "is
// this a real Role enum value" (which includes CAMERA_SHOP regardless of
// MARKETPLACE_ENABLED, and includes every role regardless of what the
// account already has active). Called again inside activateRoleFromPayment
// right before actually flipping the role live, since real time passes
// between creating an intent and its confirmation landing (a MoMo/ZaloPay
// redirect-and-pay round trip, or a bank-transfer submission sitting in
// the admin queue for days) during which the account's eligibility can
// change — a RoleChangeRequest approval, or MARKETPLACE_ENABLED flipping.
async function assertPayableRole(userId: string, role: Role) {
  if (role === "CAMERA_SHOP" && !features.marketplaceEnabled) {
    throw new PaymentError("invalid_role");
  }

  const currentRole = await db.userRole.findFirst({
    where: { userId, active: true, role: { in: PAID_ROLES } },
    select: { role: true },
  });
  // No current paid role at all: any valid role above is a first-time
  // activation. A current paid role: only paying to renew/extend THAT
  // SAME role is allowed — switching roles goes through the existing
  // admin-approved RoleChangeRequest flow, never silently through a
  // payment. Without this, paying for a different role than the one
  // already active would leave two providers "active" on one account at
  // once.
  if (currentRole && currentRole.role !== role) {
    throw new PaymentError("role_mismatch");
  }
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
//
// Concurrency: the payment.updateMany's `where: { id, status: fromStatus }`
// is an atomic compare-and-swap — Postgres row-level locking means at
// most one concurrent caller can match it and actually transition the
// row (a duplicate MoMo IPN delivery, or two admins clicking approve on
// the same AWAITING_REVIEW row at once). A caller that loses the race
// gets `count: 0` and this returns null without touching UserRole/
// Subscription/notifications at all — not a partial write. The claim and
// the role/subscription upserts run in one db.$transaction so a DB error
// between them can never leave "payment SUCCEEDED but role still
// inactive" or the reverse; notifyCritical (a side effect, not a DB
// write, and its own failure shouldn't roll back already-committed
// state) runs after the transaction commits, not inside it.
//
// Role re-validated via assertPayableRole right before activating, not
// just at intent-creation time (see that function's comment) — if it now
// fails, the payment is still marked SUCCEEDED (the money was genuinely
// received) but the role is left untouched; this is a rare edge case
// (the account's eligibility changing in the gap between starting and
// confirming a payment), not something to silently drop or crash on, so
// it's logged to Sentry and the customer is told to contact support
// rather than getting a silent no-op.
async function activateRoleFromPayment({
  paymentId,
  userId,
  role,
  interval,
  fromStatus,
  claimData = {},
}: {
  paymentId: string;
  userId: string;
  role: Role;
  interval: BillingInterval;
  fromStatus: "PENDING" | "AWAITING_REVIEW";
  claimData?: Record<string, unknown>;
}): Promise<{ activated: boolean; payment: Payment } | null> {
  let roleValid = true;
  try {
    await assertPayableRole(userId, role);
  } catch {
    roleValid = false;
  }

  const claim = await db.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({
      where: { id: paymentId, status: fromStatus },
      data: { status: "SUCCEEDED", ...claimData },
    });
    if (result.count === 0) return null; // lost the race, or already resolved
    if (!roleValid) return { activated: false as const, expiresAt: null };

    // Renewing the SAME role's subscription extends from whichever is
    // later: its existing currentPeriodEnd, or now. Without this, paying
    // early (including via the 3-day renewal reminder) discarded
    // whatever time was already paid for, replacing it with a fresh
    // `interval` starting today.
    const existing = await tx.subscription.findFirst({
      where: { userRole: { userId, role } },
      select: { id: true, userRoleId: true, currentPeriodEnd: true },
    });
    const baseDate =
      existing?.currentPeriodEnd && existing.currentPeriodEnd > new Date()
        ? existing.currentPeriodEnd
        : new Date();
    const expiresAt = periodEndFrom(baseDate, interval);

    const userRole = await tx.userRole.upsert({
      where: { userId_role: { userId, role } },
      create: { userId, role, active: true },
      update: { active: true },
    });

    await tx.subscription.upsert({
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
        currentPeriodEnd: expiresAt,
        cancelAtPeriodEnd: false,
      },
    });

    return { activated: true as const, expiresAt };
  });

  if (!claim) return null;

  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
  });

  if (!claim.activated) {
    Sentry.captureMessage(
      `Payment ${paymentId} succeeded but role ${role} could not be activated for user ${userId} (assertPayableRole failed at confirmation time) — needs manual review.`,
      "error",
    );
    const emailT = await getEmailT();
    await notifyCritical({
      userId,
      type: "PAYMENT_FAILED",
      title: emailT("paymentRejected.heading"),
      message: emailT("paymentNeedsReview.body"),
      data: { paymentId, role },
    });
    return { activated: false, payment };
  }

  const [roleT, emailT] = await Promise.all([
    getTranslations("role"),
    getEmailT(),
  ]);
  const amountLabel = formatCurrency(payment.amount);
  const periodEndLabel = claim.expiresAt!.toLocaleDateString("vi-VN");

  await notifyCritical({
    userId,
    type: "SUBSCRIPTION_ACTIVE",
    title: emailT("receipt.heading"),
    message: emailT("receipt.body", { amountLabel, periodEndLabel }),
    data: { paymentId, role, roleLabel: roleT(role) },
    email: {
      subject: emailT("receipt.heading"),
      html: receiptEmailHtml({
        t: emailT,
        amountLabel,
        periodEndLabel,
        invoiceUrl: billingUrl(),
      }),
      dedupe: [paymentId, "RECEIPT"],
    },
  });

  return { activated: true, payment };
}

// Distinct from Stripe's paymentFailedEmailHtml (a card-decline template
// — "your profile stays active until your grace period ends") — that
// copy doesn't fit a rejected bank-transfer submission at all, which
// usually means the role was never activated in the first place. Own
// dedicated content instead, same bookingEmailShell wrapper role-change-
// requests.ts's rejection notice already uses for the same reason.
async function notifyBankTransferRejected(
  userId: string,
  paymentId: string,
  reason?: string,
) {
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
      dedupe: [paymentId, "BANK_TRANSFER_REJECTED"],
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
  await assertPayableRole(userId, role);
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
    // Atomic claim here too — a duplicate failure IPN replay must also
    // be a no-op, not repeatedly re-write providerTransactionId (harmless
    // by itself, but keeping one consistent pattern for every status
    // transition in this file is what makes the concurrency story
    // reviewable at all).
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
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

  const result = await activateRoleFromPayment({
    paymentId: payment.id,
    userId: payment.userId,
    role: payment.role,
    interval: payment.interval as BillingInterval,
    fromStatus: "PENDING",
    claimData: { providerTransactionId: String(payload.transId) },
  });

  return result?.payment ?? payment;
}

// ---------------------------------------------------------------------
// ZaloPay
// ---------------------------------------------------------------------

export async function createZalopayPaymentIntent(
  userId: string,
  role: Role,
  interval: BillingInterval,
) {
  await assertPayableRole(userId, role);
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

  const result = await activateRoleFromPayment({
    paymentId: payment.id,
    userId: payment.userId,
    role: payment.role,
    interval: payment.interval as BillingInterval,
    fromStatus: "PENDING",
    claimData: { providerTransactionId: String(data.zp_trans_id) },
  });

  return result?.payment ?? payment;
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
  await assertPayableRole(userId, role);
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
  if (!payment.role || !payment.interval) {
    throw new PaymentError("missing_role_or_interval");
  }

  if (approve) {
    // reviewedBy/reviewedAt now set atomically as part of the same claim
    // that transitions status — previously a separate db.payment.update
    // ran BEFORE activateRoleFromPayment's own read-then-write, which is
    // exactly the kind of gap that let two concurrent reviews (one
    // approve, one reject) both believe they were the one making the
    // decision. Status is no longer checked here at all — the atomic
    // claim inside activateRoleFromPayment (`where: { status:
    // "AWAITING_REVIEW" }`) is the single source of truth for whether
    // this call is the one that gets to act, for both branches.
    const result = await activateRoleFromPayment({
      paymentId,
      userId: payment.userId,
      role: payment.role,
      interval: payment.interval as BillingInterval,
      fromStatus: "AWAITING_REVIEW",
      claimData: { reviewedBy: adminId, reviewedAt: new Date() },
    });
    if (!result) throw new PaymentError("already_reviewed");
  } else {
    const claim = await db.payment.updateMany({
      where: { id: paymentId, status: "AWAITING_REVIEW" },
      data: {
        status: "FAILED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });
    if (claim.count === 0) throw new PaymentError("already_reviewed");
    await notifyBankTransferRejected(payment.userId, payment.id, reason);
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

// The counterpart to isSubscriptionUsable's currentPeriodEnd check
// (src/lib/auth-helpers.ts) — that predicate stops an expired local-rail
// subscription from granting access at read time, but nothing was ever
// writing the actual DB state to match (status stayed ACTIVE forever,
// unlike Stripe's own webhooks). This makes the two agree: once
// currentPeriodEnd has passed, transition to EXPIRED, deactivate the
// role, and unpublish the profile — the same 3-way state change
// services/subscription.ts's handleSubscriptionDeleted already performs
// for a cancelled Stripe subscription.
export async function expireLocalSubscriptions() {
  const now = new Date();
  const candidates = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      stripeSubscriptionId: null,
      currentPeriodEnd: { lt: now },
    },
    include: { userRole: true },
  });

  const emailT = await getEmailT();
  let expired = 0;

  for (const subscription of candidates) {
    // Atomic claim, same reasoning as activateRoleFromPayment — a
    // renewal payment could land for this exact subscription between the
    // findMany above and this update; only proceed if it's still ACTIVE
    // at write time, so a concurrent renewal always wins over expiry.
    const claim = await db.subscription.updateMany({
      where: { id: subscription.id, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
    if (claim.count === 0) continue;

    await db.$transaction([
      db.userRole.update({
        where: { id: subscription.userRoleId },
        data: { active: false },
      }),
      db.profile.updateMany({
        where: {
          userId: subscription.userRole.userId,
          role: subscription.userRole.role,
        },
        data: { isPublished: false },
      }),
    ]);

    // The role's profile is now unpublished — clear it from public caches.
    await revalidatePublicProfile(subscription.userRole.userId);

    await notifyCritical({
      userId: subscription.userRole.userId,
      type: "SUBSCRIPTION_CANCELLED",
      title: emailT("subscriptionEnded.heading"),
      message: emailT("subscriptionEnded.body"),
      data: { role: subscription.userRole.role },
      email: {
        subject: emailT("subscriptionEnded.heading"),
        html: subscriptionEndedEmailHtml({
          t: emailT,
          billingUrl: billingUrl(),
        }),
        dedupe: [subscription.id, "EXPIRED"],
      },
    });
    expired++;
  }

  return expired;
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
