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

export async function requireActiveSubscription(userId: string, role: Role) {
  const userRole = await requireRole(userId, role);

  const subscription = await db.subscription.findUnique({
    where: { userRoleId: userRole.id },
  });
  if (!subscription || subscription.status !== "ACTIVE") {
    throw new AuthError(`Active subscription required for role: ${role}`, 403);
  }
  return subscription;
}

// Checks the session's already-loaded active roles (no DB call) — for gates
// like "any paid role", not tied to a specific subscription. Phase 7 (Stripe)
// hasn't landed yet, so requirePaidRole/requireActiveSubscription would
// reject every seeded and newly-registered account; use this instead until
// subscriptions are real.
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

  const active = userRoles.find((ur) => ur.subscription?.status === "ACTIVE");
  if (!active) {
    throw new AuthError("An active paid role subscription is required", 403);
  }
  return active;
}
