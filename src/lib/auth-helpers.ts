import type { Role } from "@prisma/client";
import type { Session } from "next-auth";

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

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Unauthorized", 401);
  }
  return session;
}

export async function requireRole(userId: string, role: Role) {
  const userRole = await db.userRole.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (!userRole?.active) {
    throw new AuthError(`Missing required role: ${role}`, 403);
  }
  return userRole;
}

// A subscription grants access when it's ACTIVE/TRIALING, or PAST_DUE but
// still inside its grace period (payment failed, but the role stays fully
// usable until graceEndsAt so a card hiccup doesn't instantly take a
// provider's profile offline).
function isSubscriptionUsable(subscription: { status: string; graceEndsAt: Date | null }) {
  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") return true;
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
    throw new AuthError(`Active subscription required for role: ${role}`, 403);
  }
  return subscription;
}

// Checks the session's already-loaded active roles (no DB call) — for gates
// like "any paid role", not tied to a specific subscription. Used where a
// subscription check isn't warranted (e.g. viewing your own inactive-role
// settings) or as a fast pre-check before the DB-backed subscription checks.
export function requireAnyRole(session: Session, roles: Role[]) {
  const hasRole = session.user.roles.some((role) => roles.includes(role));
  if (!hasRole) {
    throw new AuthError(`Missing one of the required roles: ${roles.join(", ")}`, 403);
  }
}

export async function requirePaidRole(userId: string) {
  const userRoles = await db.userRole.findMany({
    where: { userId, active: true, role: { in: PAID_ROLES } },
    include: { subscription: true },
  });

  const active = userRoles.find((ur) => ur.subscription && isSubscriptionUsable(ur.subscription));
  if (!active) {
    throw new AuthError("An active paid role subscription is required", 403);
  }
  return active;
}
