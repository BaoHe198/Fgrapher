import type { ConsentPurpose } from "@prisma/client";

import { db } from "@/lib/db";

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// Always inserts a NEW row — never updates a previous one — so the full
// grant/revoke history for a user/purpose is always reconstructable (see
// prisma/schema.prisma's ConsentRecord comment). `granted` decides
// whether this row represents a grant event (grantedAt set) or a revoke
// event (revokedAt set), never both.
export async function recordConsent({
  userId,
  purpose,
  granted,
  policyVersion,
  ipAddress,
  userAgent,
}: {
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
} & RequestMeta) {
  const now = new Date();
  return db.consentRecord.create({
    data: {
      userId,
      purpose,
      granted,
      policyVersion,
      grantedAt: granted ? now : null,
      revokedAt: granted ? null : now,
      ipAddress,
      userAgent,
    },
  });
}

export async function revokeConsent(
  userId: string,
  purpose: ConsentPurpose,
  policyVersion: string,
  meta?: RequestMeta,
) {
  return recordConsent({
    userId,
    purpose,
    granted: false,
    policyVersion,
    ...meta,
  });
}

// The most recent ConsentRecord row for this (userId, purpose) decides
// current status — false if none exists yet (never granted).
export async function hasConsent(
  userId: string,
  purpose: ConsentPurpose,
): Promise<boolean> {
  const latest = await db.consentRecord.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
    select: { granted: true },
  });
  return latest?.granted ?? false;
}

export async function logAudit({
  actorId,
  action,
  targetType,
  targetId,
  metadata,
  ipAddress,
  userAgent,
}: {
  actorId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
} & RequestMeta) {
  return db.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      metadata: metadata as never,
      ipAddress,
      userAgent,
    },
  });
}

// Gathers every personally-identifying / user-generated record into one
// JSON export — the "tải về dữ liệu của tôi" feature. passwordHash is
// deliberately excluded even though it's technically "about" the user;
// exporting a hash serves no purpose for the user and is one less place
// a leak of the export file would matter.
export async function exportUserData(userId: string) {
  const [
    user,
    roles,
    profiles,
    bookingsAsCustomer,
    bookingsAsProvider,
    reviewsWritten,
    reviewsReceived,
    consentRecords,
    orders,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        username: true,
        phone: true,
        location: true,
        bio: true,
        dateOfBirth: true,
        createdAt: true,
      },
    }),
    db.userRole.findMany({
      where: { userId },
      select: { role: true, active: true, createdAt: true },
    }),
    db.profile.findMany({ where: { userId } }),
    db.booking.findMany({ where: { customerId: userId } }),
    db.booking.findMany({ where: { providerId: userId } }),
    db.review.findMany({ where: { reviewerId: userId } }),
    db.review.findMany({ where: { reviewedId: userId } }),
    db.consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    db.order.findMany({ where: { customerId: userId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    roles,
    profiles,
    bookingsAsCustomer,
    bookingsAsProvider,
    reviewsWritten,
    reviewsReceived,
    consentHistory: consentRecords,
    orders,
  };
}

export async function requestDataExport(userId: string) {
  return db.dataRequest.create({
    data: { userId, type: "EXPORT", status: "PENDING" },
  });
}

export async function requestDeletion(userId: string) {
  return db.dataRequest.create({
    data: { userId, type: "DELETION", status: "PENDING" },
  });
}

const DELETED_USER_LABEL = "Người dùng đã xóa";

// Anonymizes rather than hard-deletes the User row itself, and anything
// the OTHER party in a relationship needs to keep (completed bookings,
// written reviews) — only the row's PII is stripped, id and the rows
// that reference it stay valid. Hard-deletes what's unambiguously this
// user's own content: portfolio media (cascades from deleting Profile),
// services (same cascade), and every message they sent or received.
export async function processDeletion(userId: string, requestId?: string) {
  await db.$transaction([
    db.message.deleteMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    }),
    db.conversationParticipant.deleteMany({ where: { userId } }),
    // ProfileMedia + Service cascade-delete from their parent Profile —
    // see those models' onDelete: Cascade in the schema.
    db.profile.deleteMany({ where: { userId } }),
    db.user.update({
      where: { id: userId },
      data: {
        name: DELETED_USER_LABEL,
        firstName: DELETED_USER_LABEL,
        lastName: null,
        // Keeps the unique constraint satisfied without leaking the real
        // address anywhere, including in an admin's own UI.
        email: `deleted-${userId}@fgrapher.invalid`,
        username: null,
        phone: null,
        avatar: null,
        image: null,
        coverImage: null,
        bio: null,
        location: null,
        latitude: null,
        longitude: null,
        dateOfBirth: null,
        passwordHash: null,
        deletedAt: new Date(),
      },
    }),
    ...(requestId
      ? [
          db.dataRequest.update({
            where: { id: requestId },
            data: { status: "COMPLETED", completedAt: new Date() },
          }),
        ]
      : []),
  ]);

  await logAudit({
    actorId: userId,
    action: "ACCOUNT_DELETION_PROCESSED",
    targetType: "user",
    targetId: userId,
  });

  // Orphaned conversations (every participant deleted) are otherwise
  // invisible dead rows — clean them up, matching prisma/seed.ts's own
  // cleanup logic for the same situation.
  await db.conversation.deleteMany({ where: { participants: { none: {} } } });
}
