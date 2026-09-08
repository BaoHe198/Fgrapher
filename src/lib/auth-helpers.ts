import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// These messages ultimately reach the client as the API's `message` field
// (see e.g. src/app/api/bookings/route.ts's `message: err.message`), so
// they're translated via getTranslations() — every caller of requireAuth/
// requireRole/etc. runs inside a Next.js request (Route Handler or Server
// Component), the same context next-intl's request-scoped locale cookie
// read (src/i18n/request.ts) has already been confirmed to work in.
//
// Live isSuspended/deletedAt check — JWT sessions have no server-side
// revocation list (docs/DEVELOPMENT.md's technical debt register), so a
// still-valid cookie issued before a suspension/soft-delete would
// otherwise keep passing every check that only looks at session?.user.
// auth.ts's signIn callback already blocks a *new* sign-in once
// isSuspended is set, but does nothing for a session that was already
// live at that moment — this is the per-request check that actually
// closes that gap for every protected API route (every one of them
// calls requireAuth() first, per this file's own documented convention).
// (dashboard)/layout.tsx carries the equivalent check for page rendering
// — pages outside that group that call auth() directly for optional/
// contextual display (not a protected action) are not covered here, since
// every actual mutation still routes through an API handler that is.
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    const t = await getTranslations("libServices.auth");
    throw new AuthError(t("unauthorized"), 401);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isSuspended: true, deletedAt: true },
  });
  if (!user || user.isSuspended || user.deletedAt) {
    const t = await getTranslations("libServices.auth");
    throw new AuthError(t("unauthorized"), 401);
  }

  return session;
}

// Every /api/cron/** route calls this first. The three call sites used to
// each inline `if (process.env.CRON_SECRET && authHeader !== ...)` — which
// fails OPEN (skips the check entirely) whenever CRON_SECRET is unset, so
// a misconfigured deployment (the var never set on Vercel) would leave
// every cron route, including the one that deletes KYC documents, publicly
// callable with no credential at all. This fails CLOSED instead outside
// local development: an unset secret in staging/production is treated as
// a misconfiguration, not an invitation.
export function requireCronSecret(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "development") return;
    throw new AuthError("CRON_SECRET is not configured", 401);
  }

  if (authHeader !== `Bearer ${secret}`) {
    throw new AuthError("Unauthorized", 401);
  }
}

export async function requireRole(userId: string, role: Role) {
  const userRole = await db.userRole.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (!userRole?.active) {
    const t = await getTranslations("libServices.auth");
    throw new AuthError(t("missingRole", { role }), 403);
  }
  return userRole;
}

// A subscription grants access when it's ACTIVE/TRIALING *and not past its
// own currentPeriodEnd*, or PAST_DUE but still inside its grace period
// (payment failed, but the role stays fully usable until graceEndsAt so a
// card hiccup doesn't instantly take a provider's profile offline).
//
// The currentPeriodEnd check matters most for the local payment rails
// (MoMo/ZaloPay/bank transfer, src/services/payments.ts) and manually
// assigned plans (assignManualPlan) — nothing ever flips their status
// away from ACTIVE on its own (Stripe subscriptions get that from
// webhooks; these don't), so without this a plan that's genuinely
// expired keeps granting access forever. currentPeriodEnd null is
// treated as still-usable — defensive only, a real Subscription row
// always has one; this predicate shouldn't be the thing that breaks if
// that assumption is ever wrong.
function isSubscriptionUsable(subscription: {
  status: string;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
}) {
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    return (
      !subscription.currentPeriodEnd ||
      subscription.currentPeriodEnd > new Date()
    );
  }
  if (subscription.status === "PAST_DUE" && subscription.graceEndsAt) {
    return subscription.graceEndsAt > new Date();
  }
  return false;
}

export async function requireActiveSubscription(userId: string, role: Role) {
  const userRole = await requireRole(userId, role);

  const subscription = await db.subscription.findUnique({
    where: { userRoleId: userRole.id },
  });
  if (!subscription || !isSubscriptionUsable(subscription)) {
    const t = await getTranslations("libServices.auth");
    throw new AuthError(t("activeSubscriptionRequired", { role }), 403);
  }
  return subscription;
}

// Checks the session's already-loaded active roles (no DB call) — for gates
// like "any paid role", not tied to a specific subscription. Used where a
// subscription check isn't warranted (e.g. viewing your own inactive-role
// settings) or as a fast pre-check before the DB-backed subscription checks.
// Synchronous by design (checks the already-loaded session, no DB call) —
// can't call the async getTranslations() here, so this one keeps an
// English fallback message. Callers with a translated `t` instance can
// catch AuthError and re-map its message; none currently do, so this is
// left as-is rather than forcing an awkward refactor.
// TODO(i18n): requireAnyRole's thrown message stays English-only until a
// caller wires through a translated re-map, since this function can't be
// made async without changing every call site's signature.
export function requireAnyRole(session: Session, roles: Role[]) {
  const hasRole = session.user.roles.some((role) => roles.includes(role));
  if (!hasRole) {
    throw new AuthError(
      `Missing one of the required roles: ${roles.join(", ")}`,
      403,
    );
  }
}

export async function requirePaidRole(userId: string) {
  const userRoles = await db.userRole.findMany({
    where: { userId, active: true, role: { in: PAID_ROLES } },
    include: { subscription: true },
  });

  const active = userRoles.find(
    (ur) => ur.subscription && isSubscriptionUsable(ur.subscription),
  );
  if (!active) {
    const t = await getTranslations("libServices.auth");
    throw new AuthError(t("paidRoleRequired"), 403);
  }
  return active;
}
