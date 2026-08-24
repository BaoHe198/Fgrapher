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
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
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

// A subscription grants access when it's ACTIVE/TRIALING, or PAST_DUE but
// still inside its grace period (payment failed, but the role stays fully
// usable until graceEndsAt so a card hiccup doesn't instantly take a
// provider's profile offline).
function isSubscriptionUsable(subscription: {
  status: string;
  graceEndsAt: Date | null;
}) {
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING")
    return true;
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
