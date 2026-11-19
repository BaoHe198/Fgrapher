import type { ConsentPurpose } from "@prisma/client";

import {
  revalidatePublicProfile,
  revalidateProfileUsername,
} from "@/lib/cache";
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
    stockAlerts,
    savedPhotos,
    serviceRequests,
    requestOffers,
    posts,
    comments,
    products,
    productReviews,
    savedProfiles,
    following,
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
    // "Báo cho tôi khi có hàng" requests: what this person wanted to buy.
    db.stockAlert.findMany({
      where: { userId },
      select: {
        productId: true,
        notifiedAt: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    // "Bảng ý tưởng": the photos this person pinned, and whose they are.
    db.savedMedia.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        mediaId: true,
        createdAt: true,
        media: {
          select: {
            url: true,
            profile: { select: { displayName: true, role: true } },
          },
        },
      },
    }),
    // Everything below is content this person wrote or a choice they made,
    // and none of it was in the export: F Booking requests and offers,
    // community posts and comments, Chợ F listings and product reviews, the
    // artists they saved and the people they follow.
    db.serviceRequest.findMany({
      where: { customerId: userId },
      include: { references: { select: { mediaUrl: true } } },
    }),
    db.requestOffer.findMany({
      where: { providerId: userId },
      include: { request: { select: { code: true, title: true } } },
    }),
    db.post.findMany({
      where: { userId, deletedAt: null },
      include: { media: { select: { url: true } } },
    }),
    db.comment.findMany({
      where: { userId, deletedAt: null },
      select: { postId: true, content: true, createdAt: true },
    }),
    db.product.findMany({
      where: { userId, deletedAt: null },
      include: { images: { select: { url: true } } },
    }),
    db.productReview.findMany({ where: { reviewerId: userId } }),
    db.savedProfile.findMany({
      where: { userId },
      select: { profileId: true, createdAt: true },
    }),
    db.follow.findMany({
      where: { followerId: userId },
      select: {
        createdAt: true,
        following: { select: { username: true, name: true } },
      },
    }),
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
    stockAlerts,
    savedPhotos,
    serviceRequests,
    requestOffers,
    posts,
    comments,
    products,
    productReviews,
    savedProfiles,
    following,
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
//
// Anything added to this function that holds personal data must be added to
// exportUserData() above as well, and the other way round.
export async function processDeletion(userId: string, requestId?: string) {
  // Captured before the transaction nulls it — the reviver in
  // revalidatePublicProfile can't resolve a username that no longer exists.
  const before = await db.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      email: true,
      profiles: { select: { id: true } },
    },
  });

  // First, close whatever is still in motion with other people (upcoming
  // bookings, open requests, pending offers) through the functions that own
  // those changes, so the other side is told by name — see
  // services/account-closure.ts. Imported here, not at the top: that module
  // reaches bookings and offers, which import logAudit from this one.
  const { windDownAccount } = await import("@/services/account-closure");
  await windDownAccount(userId);

  // Identity documents do not wait out their 90 days once the person has
  // asked to be erased. The verification outcome itself (status, date,
  // reviewer, ID-number hash) stays on the role rows as the audit trail.
  const { purgeKycDocumentsNow } = await import("@/services/verification");
  await purgeKycDocumentsNow({ userId }, "account_deleted");

  const now = new Date();
  // Posts whose like/comment counters must be recounted afterwards.
  const [likedPosts, commentedPosts] = await Promise.all([
    db.like.findMany({ where: { userId }, select: { postId: true } }),
    db.comment.findMany({
      where: { userId, deletedAt: null },
      select: { postId: true },
    }),
  ]);
  const touchedPostIds = [
    ...new Set([...likedPosts, ...commentedPosts].map((row) => row.postId)),
  ];

  await db.$transaction([
    db.message.deleteMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    }),
    db.conversationParticipant.deleteMany({ where: { userId } }),
    // Back-in-stock requests say what this person wanted to buy.
    db.stockAlert.deleteMany({ where: { userId } }),
    // The mood board says whose work this person liked.
    db.savedMedia.deleteMany({ where: { userId } }),
    // ProfileMedia + Service cascade-delete from their parent Profile —
    // see those models' onDelete: Cascade in the schema.
    db.profile.deleteMany({ where: { userId } }),
    // Reference photos/videos the customer attached — their own content,
    // very often pictures of people. The bookings themselves are kept (see
    // this function's header: the provider needs the record of the job),
    // which used to mean the attached media stayed with them too, linked
    // and viewable, after the account that uploaded it was deleted. The
    // booking survives; the customer's media does not.
    //
    // This removes the links, not the files: nothing in processDeletion
    // deletes Cloudinary assets (portfolio media included — the cascade
    // above drops rows, not files). Tracked as a known gap in
    // docs/ops/Fgrapher-checklist-viec-thu-cong.xlsx.
    db.booking.updateMany({
      where: { customerId: userId },
      data: { referenceImages: [] },
    }),
    db.serviceRequestReference.deleteMany({
      where: { request: { customerId: userId } },
    }),
    // The same reasoning for the words of a request. One that became a
    // booking keeps its text (the booking carries a copy the provider needs
    // anyway); every other one loses the street address and the free text,
    // and an unposted draft goes entirely.
    db.serviceRequest.deleteMany({
      where: { customerId: userId, isDraft: true },
    }),
    db.serviceRequest.updateMany({
      where: { customerId: userId, bookingId: null },
      data: { detailedAddress: null, areaNote: null, description: null },
    }),
    // Listings and posts are this person's own content, on public pages. A
    // deleted seller's listing stayed for sale and their posts stayed in the
    // feed under "Người dùng đã xóa". Soft-deleted like everywhere else, so
    // an order that already bought the item keeps its line.
    db.product.updateMany({
      where: { userId, deletedAt: null },
      data: { isActive: false, deletedAt: now },
    }),
    db.cartItem.deleteMany({ where: { userId } }),
    db.post.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    db.comment.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    db.like.deleteMany({ where: { userId } }),
    // Who they followed and saved says whose work this person liked; who
    // followed them is a list pointing at an account that no longer exists.
    db.follow.deleteMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
    }),
    db.savedProfile.deleteMany({
      where: {
        OR: [
          { userId },
          { profileId: { in: (before?.profiles ?? []).map((p) => p.id) } },
        ],
      },
    }),
    // Their inbox of notifications (other people's names and what they
    // did), the sign-in links to Google, and mail still queued for or
    // recorded against the address being erased.
    db.notification.deleteMany({ where: { userId } }),
    db.account.deleteMany({ where: { userId } }),
    ...(before?.email
      ? [
          db.emailOutbox.deleteMany({ where: { to: before.email } }),
          db.waitlistEntry.deleteMany({
            where: { email: { equals: before.email, mode: "insensitive" } },
          }),
        ]
      : []),
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

  // The counters on posts this person had liked or commented on are stored,
  // not computed, so they are recounted rather than adjusted.
  for (const postId of touchedPostIds) {
    const [likeCount, commentCount] = await Promise.all([
      db.like.count({ where: { postId } }),
      db.comment.count({ where: { postId, deletedAt: null } }),
    ]);
    await db.post.update({
      where: { id: postId },
      data: { likeCount, commentCount },
    });
  }

  // Every Profile row is gone and the account is anonymized — evict it from
  // search / featured and its (now-404) public profile page.
  await revalidatePublicProfile(userId);
  if (before?.username) revalidateProfileUsername(before.username);

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
