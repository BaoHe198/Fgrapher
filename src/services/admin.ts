import type {
  ConsentPurpose,
  DataRequestStatus,
  DataRequestType,
} from "@prisma/client";

import { db } from "@/lib/db";
import { ROLE_PLANS } from "@/lib/constants/plans";
import { processDeletion } from "@/services/compliance";

const PAGE_SIZE = 50;

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfLastMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

export async function getAdminStats() {
  const monthStart = startOfMonth();
  const lastMonthStart = startOfLastMonth();

  const [
    totalUsers,
    usersLastMonth,
    activeSubscriptions,
    bookingsThisMonth,
    completedBookingsThisMonth,
    bookingGmv,
    orderGmv,
    failedPayments,
    pendingReports,
    expiringSoon,
  ] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({
      where: {
        deletedAt: null,
        createdAt: { lt: monthStart, gte: lastMonthStart },
      },
    }),
    db.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      include: { userRole: { select: { role: true } } },
    }),
    db.booking.count({ where: { createdAt: { gte: monthStart } } }),
    db.booking.count({
      where: { createdAt: { gte: monthStart }, status: "COMPLETED" },
    }),
    db.booking.aggregate({
      where: {
        createdAt: { gte: monthStart },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      _sum: { totalPrice: true },
    }),
    db.order.aggregate({
      where: { createdAt: { gte: monthStart }, status: { not: "CANCELLED" } },
      _sum: { totalPrice: true },
    }),
    db.subscription.count({ where: { status: "PAST_DUE" } }),
    db.report.count({ where: { status: "PENDING" } }),
    db.subscription.count({
      where: {
        status: { in: ["ACTIVE", "TRIALING"] },
        currentPeriodEnd: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 86_400_000),
        },
      },
    }),
  ]);

  const mrr = activeSubscriptions.reduce(
    (sum, sub) => sum + (ROLE_PLANS[sub.userRole.role]?.monthly ?? 0),
    0,
  );

  return {
    totalUsers,
    userGrowthPercent:
      usersLastMonth > 0
        ? Math.round(((totalUsers - usersLastMonth) / usersLastMonth) * 100)
        : 0,
    activeSubscriptions: activeSubscriptions.length,
    mrr,
    bookingsThisMonth,
    completionRate:
      bookingsThisMonth > 0
        ? Math.round((completedBookingsThisMonth / bookingsThisMonth) * 100)
        : 0,
    bookingGmvVnd: bookingGmv._sum.totalPrice ?? 0,
    orderGmvVnd: orderGmv._sum.totalPrice ?? 0,
    failedPayments,
    pendingReports,
    expiringSoon,
  };
}

export async function getRecentActivity(limit = 15) {
  const [signups, bookings, reports] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        firstName: true,
        email: true,
        createdAt: true,
      },
    }),
    db.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        totalPrice: true,
        currency: true,
        createdAt: true,
        customer: { select: { name: true, firstName: true } },
      },
    }),
    db.report.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, targetType: true, reason: true, createdAt: true },
    }),
  ]);

  const events = [
    ...signups.map((u) => ({
      type: "signup" as const,
      id: u.id,
      label: `${u.firstName ?? u.name ?? u.email} signed up`,
      timestamp: u.createdAt,
    })),
    ...bookings.map((b) => ({
      type: "booking" as const,
      id: b.id,
      label: `${b.customer.firstName ?? b.customer.name ?? "Someone"} made a booking`,
      timestamp: b.createdAt,
    })),
    ...reports.map((r) => ({
      type: "report" as const,
      id: r.id,
      label: `New ${r.targetType} report — ${r.reason}`,
      timestamp: r.createdAt,
    })),
  ];

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

export async function listAdminUsers({
  search,
  role,
  page = 1,
}: {
  search?: string;
  role?: string;
  page?: number;
}) {
  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { username: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role ? { roles: { some: { role: role as never, active: true } } } : {}),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { roles: { where: { active: true }, select: { role: true } } },
    }),
    db.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getAdminUserDetail(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    include: {
      roles: { include: { subscription: true } },
      bookingsAsCustomer: { select: { id: true, status: true }, take: 200 },
      bookingsAsProvider: { select: { id: true, status: true }, take: 200 },
    },
  });
  return user;
}

export async function suspendUser({
  userId,
  reason,
  until,
}: {
  userId: string;
  reason: string;
  until?: Date;
}) {
  return db.user.update({
    where: { id: userId },
    data: { isSuspended: true, suspendedReason: reason, suspendedUntil: until },
  });
}

export async function unsuspendUser(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { isSuspended: false, suspendedReason: null, suspendedUntil: null },
  });
}

export async function verifyUser(userId: string) {
  return db.user.update({ where: { id: userId }, data: { isVerified: true } });
}

export async function softDeleteAdminUser(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
}

export async function updateAdminNotes(userId: string, notes: string) {
  return db.user.update({ where: { id: userId }, data: { adminNotes: notes } });
}

export async function listReports({
  status,
  targetType,
  page = 1,
}: {
  status?: "PENDING" | "REVIEWING" | "RESOLVED" | "DISMISSED";
  targetType?: string;
  page?: number;
}) {
  const where = {
    ...(status ? { status } : {}),
    ...(targetType ? { targetType } : {}),
  };

  const [reports, total] = await Promise.all([
    db.report.findMany({
      where,
      // HIGH-priority reports (inappropriate content, appears-to-be-a-minor
      // — see HIGH_PRIORITY_REPORT_REASONS) surface first regardless of age.
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.report.count({ where }),
  ]);

  const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
  const reporters = await db.user.findMany({
    where: { id: { in: reporterIds } },
    select: { id: true, name: true, firstName: true, email: true },
  });
  const reporterById = new Map(reporters.map((r) => [r.id, r]));

  return {
    reports: reports.map((r) => ({
      ...r,
      reporter: reporterById.get(r.reporterId) ?? null,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// Identity verification queue (built for MODEL — see
// docs/guides/fgrapher-prompts-batch-2.md §3b). The user-facing ID upload
// flow that would move a UserRole to PENDING is deliberately not wired up
// yet, so this list is expected to be empty until that flow is enabled —
// the queue itself is real infrastructure, ready for that switch to flip.
export async function listPendingVerifications() {
  return db.userRole.findMany({
    where: { verificationStatus: "PENDING" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          email: true,
          avatar: true,
          dateOfBirth: true,
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });
}

export async function reviewVerification({
  userRoleId,
  approve,
  reason,
}: {
  userRoleId: string;
  approve: boolean;
  reason?: string;
}) {
  return db.userRole.update({
    where: { id: userRoleId },
    data: approve
      ? {
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
          verificationRejectedReason: null,
        }
      : { verificationStatus: "REJECTED", verificationRejectedReason: reason },
  });
}

export async function resolveReport({
  reportId,
  adminId,
  status,
  note,
}: {
  reportId: string;
  adminId: string;
  status: "RESOLVED" | "DISMISSED" | "REVIEWING";
  note?: string;
}) {
  return db.report.update({
    where: { id: reportId },
    data: {
      status,
      reviewedBy: adminId,
      reviewNote: note,
      resolvedAt:
        status === "RESOLVED" || status === "DISMISSED" ? new Date() : null,
    },
  });
}

// Compliance (Prompt B2, docs/guides/fgrapher-danh-gia-va-prompt-sua-doi.md).
export async function listDataRequests({
  type,
  status,
  page = 1,
}: {
  type?: DataRequestType;
  status?: DataRequestStatus;
  page?: number;
}) {
  const where = { ...(type ? { type } : {}), ...(status ? { status } : {}) };

  const [requests, total] = await Promise.all([
    db.dataRequest.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, firstName: true, email: true },
        },
      },
      // Oldest first — the ones closest to (or past) their SLA deadline
      // need attention first.
      orderBy: { requestedAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.dataRequest.count({ where }),
  ]);

  return {
    requests,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// Only DELETION requests go through here — EXPORT requests are completed
// synchronously by POST /api/users/me/export the moment they're created,
// so there's nothing left for an admin to action on those.
export async function processDataRequest({
  id,
  action,
  note,
}: {
  id: string;
  action: "complete" | "reject";
  note?: string;
}) {
  const request = await db.dataRequest.findUniqueOrThrow({ where: { id } });
  if (request.type !== "DELETION") {
    throw new Error("Only deletion requests can be processed here");
  }

  if (action === "reject") {
    return db.dataRequest.update({
      where: { id },
      data: { status: "REJECTED", note, completedAt: new Date() },
    });
  }

  await db.dataRequest.update({
    where: { id },
    data: { status: "PROCESSING" },
  });
  // Sets status COMPLETED + completedAt itself once the anonymization/
  // hard-delete transaction succeeds — see services/compliance.ts.
  await processDeletion(request.userId, id);
  return db.dataRequest.findUniqueOrThrow({ where: { id } });
}

export async function searchAuditLog({
  actorId,
  action,
  from,
  to,
  page = 1,
}: {
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
}) {
  const where = {
    ...(actorId ? { actorId } : {}),
    ...(action
      ? { action: { contains: action, mode: "insensitive" as const } }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);

  // actorId is a loose reference (see prisma/schema.prisma's AuditLog
  // comment), not a Prisma relation — resolve display info separately,
  // same pattern as listReports' reporterById above.
  const actorIds = [
    ...new Set(
      logs.map((l) => l.actorId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, firstName: true, email: true },
  });
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return {
    logs: logs.map((l) => ({
      ...l,
      actor: l.actorId ? (actorById.get(l.actorId) ?? null) : null,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

const CONSENT_PURPOSES: ConsentPurpose[] = [
  "SERVICE",
  "MARKETING",
  "ANALYTICS",
];

// Counts the most recent ConsentRecord per (user, purpose) — matching
// hasConsent's own "latest row wins" rule — rather than every row ever
// written, since a user who granted then revoked should count once, as
// revoked.
export async function getConsentStats() {
  return Promise.all(
    CONSENT_PURPOSES.map(async (purpose) => {
      const latestPerUser = await db.consentRecord.findMany({
        where: { purpose },
        orderBy: { createdAt: "desc" },
        distinct: ["userId"],
        select: { granted: true },
      });
      const granted = latestPerUser.filter((r) => r.granted).length;
      return {
        purpose,
        granted,
        revoked: latestPerUser.length - granted,
        total: latestPerUser.length,
      };
    }),
  );
}
