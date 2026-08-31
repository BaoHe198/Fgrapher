import type { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";

export class ProfileNotVerifiedError extends Error {}
export class ProfileNotFoundError extends Error {}
export class ProfileHasNoApprovedMediaError extends Error {}
export class ProfileMissingLocationError extends Error {}
export class ProfileMissingCategoryError extends Error {}

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
  const t = await getTranslations("libServices.publicProfile");

  if (isPublished) {
    const userRole = await db.userRole.findUnique({
      where: { userId_role: { userId, role } },
    });
    if (userRole?.verificationStatus !== "VERIFIED") {
      throw new ProfileNotVerifiedError(t("notVerified"));
    }
  }

  const profile = await db.profile.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (!profile) {
    throw new ProfileNotFoundError(t("notFound"));
  }

  if (isPublished) {
    const approvedMedia = await db.profileMedia.findFirst({
      where: { profileId: profile.id, moderationStatus: "APPROVED" },
      select: { id: true },
    });
    if (!approvedMedia) {
      throw new ProfileHasNoApprovedMediaError(t("noApprovedMedia"));
    }
  }

  // Prompt G2, VIỆC 4 — "Ít nhất 1 thể loại là bắt buộc trước khi công
  // khai hồ sơ": specialty categories are how both the search filter
  // (G4) and the public profile page (VIỆC 5) let clients find the right
  // provider, so a profile with none of those set isn't ready to go live.
  if (isPublished && profile.categories.length === 0) {
    throw new ProfileMissingCategoryError(t("missingCategory"));
  }

  // Prompt B4, VIỆC 3 — a Studio's whole value proposition is "come shoot
  // here," so unlike other roles (where provinceId is a nice-to-have for
  // search filtering), a Studio without a specific address + province +
  // ward is unusable for customers deciding whether to book. Other roles
  // stay optional here — search.ts still works for them without it (falls
  // back to the free-text city filter).
  if (isPublished && role === "STUDIO") {
    if (!profile.address || !profile.provinceId || !profile.wardId) {
      throw new ProfileMissingLocationError(t("missingLocation"));
    }
  }

  return db.profile.update({
    where: { id: profile.id },
    data: { isPublished },
  });
}

export async function getPublicProfileUser(username: string) {
  const user = await db.user.findUnique({
    where: { username, deletedAt: null },
    // Explicit select, not include — this is a *public* read, and an
    // unfiltered include on User returns every scalar column (email,
    // phone, passwordHash...) to the caller. Nothing downstream spreads
    // the raw object into a Client Component prop today, but that's the
    // caller being careful, not this query — list every field the public
    // profile page actually uses (src/app/(public)/profile/[username]/
    // page.tsx) so a future edit can't silently leak the rest.
    select: {
      id: true,
      name: true,
      firstName: true,
      avatar: true,
      coverImage: true,
      location: true,
      acceptingBookings: true,
      // Never rendered directly — only ever passed through
      // getAgeRangeLabel() to compute a bucketed range, MODEL role only.
      dateOfBirth: true,
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
          // Prompt G3, VIỆC 4 — the public Portfolio tab shows albums, not
          // a flat grid. An album with zero approved photos would render
          // as an empty tile, so it's excluded here (not just visually
          // hidden client-side) via the `media: { some: ... }` filter —
          // and the nested `media` picked back up below is filtered the
          // same way so a not-yet-approved photo can't leak through an
          // otherwise-visible album either.
          albums: {
            where: {
              deletedAt: null,
              isPublished: true,
              media: {
                some: { moderationStatus: "APPROVED", deletedAt: null },
              },
            },
            orderBy: { sortOrder: "asc" },
            include: {
              media: {
                where: { moderationStatus: "APPROVED", deletedAt: null },
                orderBy: { order: "asc" },
              },
              // Prisma can't apply `media`'s APPROVED/not-deleted `where`
              // to a to-one relation like this — coverMedia could point at
              // a photo still pending review. Select its moderation fields
              // too so the mapping below can fall back to the album's own
              // (already-filtered) `media[0]` instead of leaking an
              // unapproved image URL to public viewers.
              coverMedia: {
                select: {
                  id: true,
                  url: true,
                  type: true,
                  moderationStatus: true,
                  deletedAt: true,
                },
              },
            },
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

  if (!user) return user;

  return {
    ...user,
    profiles: user.profiles.map((profile) => ({
      ...profile,
      albums: profile.albums.map((album) => {
        const cover =
          album.coverMedia &&
          album.coverMedia.moderationStatus === "APPROVED" &&
          !album.coverMedia.deletedAt
            ? album.coverMedia
            : (album.media[0] ?? null);
        return {
          ...album,
          coverMedia: cover
            ? { id: cover.id, url: cover.url, type: cover.type }
            : null,
        };
      }),
    })),
  };
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
