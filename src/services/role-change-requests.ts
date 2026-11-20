import type { Role, RoleChangeRequest } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { revalidatePublicProfile } from "@/lib/cache";
import { bookingEmailShell } from "@/lib/email";
import { db } from "@/lib/db";
import { LOCKED_TRANSACTION, lockInTransaction } from "@/lib/db-lock";
import { PAID_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";
import { assignFreePlan } from "@/services/subscription";
import { notifyCritical } from "@/services/notification";
import { withdrawOffer } from "@/services/request-offers";
import { purgeKycDocumentsNow } from "@/services/verification";

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
  acceptedContentGuidelines?: boolean,
) {
  // Same gate as sign-up and as adding the role in settings: nobody becomes
  // a model without accepting the content guidelines. The request can only
  // exist with that acceptance, so its creation time is the acceptance time
  // (recorded on the new role when an admin approves it).
  if (toRole === "MODEL" && acceptedContentGuidelines !== true) {
    throw new RoleChangeRequestError("guidelines_required");
  }
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

  // "One pending request per account" checked and written as one step — a
  // double press on "Gửi yêu cầu" otherwise left two for the admin queue.
  return db.$transaction(async (tx) => {
    await lockInTransaction(tx, `role-change:${userId}`);
    const existingPending = await tx.roleChangeRequest.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true },
    });
    if (existingPending) {
      throw new RoleChangeRequestError("already_pending");
    }

    return tx.roleChangeRequest.create({
      data: { userId, fromRole: currentRole.role, toRole, reason },
    });
  }, LOCKED_TRANSACTION);
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

  // Take the request before doing anything with it. Approving is several
  // steps (identity documents, stale offers, the role swap), and two admins
  // on the queue at once both passed the check above: the second approval
  // died half-way with a server error, and an approval racing a rejection
  // would have deleted documents and withdrawn offers for a request that
  // ended up rejected. The claim is the reviewer's name on a still-pending
  // row; it is given back if the work fails, and one left behind by a
  // crashed request stops counting after two minutes.
  const claim = await db.roleChangeRequest.updateMany({
    where: {
      id: requestId,
      status: "PENDING",
      OR: [
        { reviewedBy: null },
        { reviewedAt: { lt: new Date(Date.now() - REVIEW_CLAIM_MS) } },
      ],
    },
    data: { reviewedBy: adminId, reviewedAt: new Date() },
  });
  if (claim.count === 0) {
    throw new RoleChangeRequestError("already_reviewed");
  }

  try {
    return await applyRoleChangeReview({ request, adminId, approve, reason });
  } catch (error) {
    await db.roleChangeRequest.updateMany({
      where: { id: requestId, status: "PENDING", reviewedBy: adminId },
      data: { reviewedBy: null, reviewedAt: null },
    });
    throw error;
  }
}

const REVIEW_CLAIM_MS = 2 * 60 * 1000;

async function applyRoleChangeReview({
  request,
  adminId,
  approve,
  reason,
}: {
  request: RoleChangeRequest;
  adminId: string;
  approve: boolean;
  reason?: string;
}) {
  const requestId = request.id;
  const [roleT, emailT] = await Promise.all([
    getTranslations("role"),
    getTranslations("libServices.email"),
  ]);

  if (approve) {
    // The old role's row is deleted below, and with it the only reference
    // to the identity documents it was verified with (kept for 90 days
    // after approval). Delete the files first — see deleteKycFiles.
    await purgeKycDocumentsNow(
      { userId: request.userId, role: request.fromRole },
      "role_removed",
    );

    // Offers made in the old role can never be honoured: accepting one
    // books that role, which this account is about to stop holding, and the
    // customer got "Nhà cung cấp hiện không nhận đặt lịch" for an offer
    // still sitting on their request. Withdrawn here, through the function
    // that owns that change (it reopens the request when no offer is left).
    // Bookings already agreed are deliberately left alone — the same person
    // can still turn up for them.
    const staleOffers = await db.requestOffer.findMany({
      where: {
        providerId: request.userId,
        status: "PENDING",
        request: { role: request.fromRole },
      },
      select: { id: true },
    });
    for (const offer of staleOffers) {
      await withdrawOffer(offer.id, request.userId);
    }

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
        create: {
          userId: request.userId,
          role: request.toRole,
          active: true,
          ...(request.toRole === "MODEL"
            ? { contentGuidelinesAcceptedAt: request.createdAt }
            : {}),
        },
        update: {
          active: true,
          ...(request.toRole === "MODEL"
            ? { contentGuidelinesAcceptedAt: request.createdAt }
            : {}),
        },
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
    // See src/lib/features.ts's freeRoleGrantEnabled comment for why
    // that's now its own condition alongside billingEnabled.
    if (!features.billingEnabled && features.freeRoleGrantEnabled) {
      await assignFreePlan(request.userId, [request.toRole]);
    }

    // The old role's Profile (possibly published) is gone and a new role is
    // active — both the browse role facets and this provider's public
    // profile change.
    await revalidatePublicProfile(request.userId);

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
        dedupe: [requestId, "APPROVED"],
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
        dedupe: [requestId, "REJECTED"],
      },
    });
  }

  return db.roleChangeRequest.findUniqueOrThrow({ where: { id: requestId } });
}

export { RoleChangeRequestError };
