import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";

export class ProfileNotVerifiedError extends Error {}
export class ProfileNotFoundError extends Error {}
export class ProfileHasNoApprovedMediaError extends Error {}

// The single write path for Profile.isPublished (Prompt B3, VIỆC 4) —
// every other read site (search.ts, sitemap.ts, this file's own queries
// above) trusts isPublished at face value, so this is the one place that
// must never let it become true without a VERIFIED UserRole. Unpublishing
// is always allowed — a provider can take themselves offline any time,
// verified or not.
export async function setProfilePublished(
  userId: string,
  role: Role,
  isPublished: boolean,
) {
  if (isPublished) {
    const userRole = await db.userRole.findUnique({
      where: { userId_role: { userId, role } },
    });
    if (userRole?.verificationStatus !== "VERIFIED") {
      throw new ProfileNotVerifiedError(
        "Your identity must be verified before this profile can go live",
      );
    }
  }

  const profile = await db.profile.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (!profile) {
    throw new ProfileNotFoundError(
      "Save your profile details before publishing",
    );
  }

  if (isPublished) {
    const approvedMedia = await db.profileMedia.findFirst({
      where: { profileId: profile.id, moderationStatus: "APPROVED" },
      select: { id: true },
    });
    if (!approvedMedia) {
      throw new ProfileHasNoApprovedMediaError(
        "Upload at least one approved portfolio photo before publishing",
      );
    }
  }

  return db.profile.update({
    where: { id: profile.id },
    data: { isPublished },
  });
}

export async function getPublicProfileUser(username: string) {
  return db.user.findUnique({
    where: { username, deletedAt: null },
    include: {
      profiles: {
        where: { isPublished: true, role: { in: PAID_ROLES } },
        // Role is a Postgres enum, so this sorts by declaration order in
        // the schema (Photographer, Videographer, ...) — deterministic
        // tab/title order regardless of which profile was created first.
        orderBy: { role: "asc" },
        include: {
          // Prompt B5, VIỆC 5 — public viewers only ever see moderated,
          // approved media. The owner's own view (dashboard/portfolio)
          // reads directly via db.profileMedia.findMany with no filter,
          // deliberately not through this function.
          media: {
            where: { moderationStatus: "APPROVED" },
            orderBy: { order: "asc" },
          },
          services: { where: { isActive: true } },
        },
      },
      // Only verificationStatus is actually used publicly (the Verified
      // badge) — the rest of UserRole (subscription, verification ID
      // fields) is never read from this query's result on the client side.
      roles: { select: { role: true, verificationStatus: true } },
    },
  });
}

export async function getProviderForBooking(providerId: string) {
  return db.user.findUnique({
    where: { id: providerId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      name: true,
      avatar: true,
      profiles: {
        where: { isPublished: true, role: { in: PAID_ROLES } },
        select: {
          role: true,
          services: { where: { isActive: true }, orderBy: { price: "asc" } },
        },
      },
    },
  });
}

export async function getProfileReviews(userId: string) {
  return db.review.findMany({
    where: { reviewedId: userId },
    include: {
      reviewer: { select: { name: true, firstName: true, avatar: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getShopProducts(userId: string) {
  return db.product.findMany({
    where: { userId, isActive: true, deletedAt: null },
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
}

export function incrementProfileView(profileId: string) {
  // Fire-and-forget — never block the page render on an analytics write.
  void db.profile
    .update({ where: { id: profileId }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}
