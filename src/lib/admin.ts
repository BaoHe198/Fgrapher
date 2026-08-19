import type { Prisma } from "@prisma/client";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function requireAdmin() {
  const session = await requireAuth();

  const isAdmin = await db.userRole.findFirst({
    where: { userId: session.user.id, role: "ADMIN", active: true },
  });
  if (!isAdmin) {
    throw new AuthError("Admin access required", 403);
  }

  return session;
}

export async function logAdminAction({
  adminId,
  action,
  targetType,
  targetId,
  details,
}: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}) {
  await db.adminAction.create({
    data: { adminId, action, targetType, targetId, details: details as Prisma.InputJsonValue },
  });
}
