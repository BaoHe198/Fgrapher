import type { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { bookingEmailShell } from "@/lib/email";
import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";
import { assignFreePlan } from "@/services/subscription";
import { notifyCritical } from "@/services/notification";

// MVP scope decision (CLAUDE.md) — an account holds at most one active
// provider role, and a VERIFIED role can't be self-removed (UserRole.
// verificationStatus). Switching to a different role while verified goes
// through this admin-approved request instead, mirroring the existing
// verification-queue pattern in this same file's sibling, services/admin.ts.

class RoleChangeRequestError extends Error {}

export async function createRoleChangeRequest(
  userId: string,
  toRole: Role,
  reason?: string,
) {
  if (!features.marketplaceEnabled && toRole === "CAMERA_SHOP") {
    throw new RoleChangeRequestError("invalid_role");
  }

  const currentRole = await db.userRole.findFirst({
    where: { userId, active: true, role: { in: PAID_ROLES } },
    select: { role: true, verificationStatus: true },
  });
  if (!currentRole) {
    throw new RoleChangeRequestError("no_active_role");
  }
  // Unverified roles already have a plain self-service remove-then-re-add
  // path (DELETE /api/users/roles/[role] + POST /api/users/roles) — this
  // request flow exists specifically for the verified case that path
  // can't reach.
  if (currentRole.verificationStatus !== "VERIFIED") {
    throw new RoleChangeRequestError("not_verified");
  }
  if (currentRole.role === toRole) {
    throw new RoleChangeRequestError("same_role");
  }

  const existingPending = await db.roleChangeRequest.findFirst({
    where: { userId, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) {
    throw new RoleChangeRequestError("already_pending");
  }

  return db.roleChangeRequest.create({
    data: { userId, fromRole: currentRole.role, toRole, reason },
  });
}

export function getPendingRoleChangeRequest(userId: string) {
  return db.roleChangeRequest.findFirst({
    where: { userId, status: "PENDING" },
  });
}

export function listRoleChangeRequests({
  status = "PENDING",
}: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
} = {}) {
  return db.roleChangeRequest.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: { id: true, name: true, firstName: true, email: true },
      },
    },
  });
}

export async function reviewRoleChangeRequest({
  requestId,
  adminId,
  approve,
  reason,
}: {
  requestId: string;
  adminId: string;
  approve: boolean;
  reason?: string;
}) {
  const request = await db.roleChangeRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new RoleChangeRequestError("not_found");
  }
  if (request.status !== "PENDING") {
    throw new RoleChangeRequestError("already_reviewed");
  }

  const [roleT, emailT] = await Promise.all([
    getTranslations("role"),
    getTranslations("libServices.email"),
  ]);

  if (approve) {
    await db.$transaction([
      // Same operation DELETE /api/users/roles/[role] already performs
      // for an unverified role — reachable here for a verified one only
      // because an admin approved it.
      db.profile.deleteMany({
        where: { userId: request.userId, role: request.fromRole },
      }),
      db.userRole.delete({
        where: {
          userId_role: { userId: request.userId, role: request.fromRole },
        },
      }),
      db.userRole.upsert({
        where: {
          userId_role: { userId: request.userId, role: request.toRole },
        },
        create: { userId: request.userId, role: request.toRole, active: true },
        update: { active: true },
      }),
      db.roleChangeRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
    ]);

    // Mirrors /api/users/roles' own assignFreePlan call (CLAUDE.md's
    // Stripe ban) — the upsert above only marks the role active, this is
    // what actually unblocks every subscription-gated feature for it.
    if (!features.billingEnabled) {
      await assignFreePlan(request.userId, [request.toRole]);
    }

    await notifyCritical({
      userId: request.userId,
      type: "ROLE_CHANGE_APPROVED",
      title: emailT("roleChangeApproved.heading"),
      message: emailT("roleChangeApproved.body", {
        role: roleT(request.toRole),
      }),
      data: { requestId },
      email: {
        subject: emailT("roleChangeApproved.heading"),
        html: bookingEmailShell({
          t: emailT,
          heading: emailT("roleChangeApproved.heading"),
          body: emailT("roleChangeApproved.body", {
            role: roleT(request.toRole),
          }),
          ctaLabel: emailT("roleChangeApproved.cta"),
          ctaUrl: `${process.env.NEXTAUTH_URL ?? ""}/dashboard/settings/roles`,
        }),
      },
    });
  } else {
    await db.roleChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewNote: reason,
      },
    });

    await notifyCritical({
      userId: request.userId,
      type: "ROLE_CHANGE_REJECTED",
      title: emailT("roleChangeRejected.heading"),
      message: reason
        ? emailT("roleChangeRejected.bodyWithReason", { reason })
        : emailT("roleChangeRejected.body"),
      data: { requestId },
      email: {
        subject: emailT("roleChangeRejected.heading"),
        html: bookingEmailShell({
          t: emailT,
          heading: emailT("roleChangeRejected.heading"),
          body: reason
            ? emailT("roleChangeRejected.bodyWithReason", {
                reason: `<strong>${reason}</strong>`,
              })
            : emailT("roleChangeRejected.body"),
          ctaLabel: emailT("roleChangeRejected.cta"),
          ctaUrl: `${process.env.NEXTAUTH_URL ?? ""}/dashboard/settings/roles`,
        }),
      },
    });
  }

  return db.roleChangeRequest.findUniqueOrThrow({ where: { id: requestId } });
}

export { RoleChangeRequestError };
