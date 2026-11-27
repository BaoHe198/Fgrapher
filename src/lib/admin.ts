import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

// Once per page render: the admin layout checks this and then every admin
// page checks it again. Same reasoning and same limits as loadAccountStatus
// in lib/auth-helpers.ts — never shared between requests, and not memoized
// at all in a Route Handler.
const loadAdminRole = cache(async function loadAdminRole(userId: string) {
  return db.userRole.findFirst({
    where: { userId, role: "ADMIN", active: true },
  });
});

export async function requireAdmin() {
  const session = await requireAuth();

  const isAdmin = await loadAdminRole(session.user.id);
  if (!isAdmin) {
    const t = await getTranslations("libServices.auth");
    throw new AuthError(t("adminAccessRequired"), 403);
  }

  return session;
}

/**
 * requireAdmin() for a Server Component page under /admin that reads data
 * itself: the session, or null where requireAdmin() would refuse (the admin
 * layout is what renders the redirect or the 404). See sessionForPage in
 * lib/auth-helpers.ts for why a page checks for itself.
 */
export async function adminSessionForPage() {
  try {
    return await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
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
    data: {
      adminId,
      action,
      targetType,
      targetId,
      details: details as Prisma.InputJsonValue,
    },
  });
}
