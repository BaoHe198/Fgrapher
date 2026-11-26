import type { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { isSubscriptionUsable } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { placeHref } from "@/lib/places";
import {
  PAID_ROLES,
  PROVIDER_ROLES,
  SHOP_ROLES,
  STOREFRONT_ROLES,
} from "@/lib/constants";
import {
  omitPrivateProfileFields,
  publicStudioAddress,
} from "@/lib/privacy/profile-privacy";
import {
  productCategoriesForRole,
  productCategoryQueryValues,
} from "@/lib/validations/product";
import {
  CACHE_KEY_VERSION,
  CACHE_TTL,
  profileNameTag,
  profileUserTag,
  revalidatePublicProfile,
  reviveDates,
  unstable_cache,
} from "@/lib/cache";

class ProfileNotVerifiedError extends Error {}
class ProfileNotFoundError extends Error {}
class ProfileHasNoApprovedMediaError extends Error {}
class ProfileMissingLocationError extends Error {}
class ProfileMissingCategoryError extends Error {}
class ProfileNoActivePlanError extends Error {}

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
    // A paid role goes public only while its plan is usable (a free plan
    // counts while free grants are on). Without this, a provider whose plan
    // expired could republish just by saving their profile (audit
    // 16/11/2026).
    if (PAID_ROLES.includes(role)) {
      const subscription = userRole.active
        ? await db.subscription.findUnique({
            where: { userRoleId: userRole.id },
          })
        : null;
      if (!subscription || !isSubscriptionUsable(subscription)) {
        throw new ProfileNoActivePlanError(t("noActivePlan"));
      }
    }
  }

  const profile = await db.profile.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (!profile) {
    throw new ProfileNotFoundError(t("notFound"));
  }

  if (isPublished) {
    // A storefront is judged on its product photos; everyone else —
    // including the costume shop, whose outfits are profile photos — on
    // approved profile media.
    const isStorefront = STOREFRONT_ROLES.includes(role);
    const approvedMedia = isStorefront
      ? await db.productImage.findFirst({
          where: {
            moderationStatus: "APPROVED",
            product: {
              userId,
              isActive: true,
              deletedAt: null,
              category: {
                in: productCategoryQueryValues(productCategoriesForRole(role)),
              },
            },
          },
          select: { id: true },
        })
      : await db.profileMedia.findFirst({
          where: {
            profileId: profile.id,
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
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
  if (
    isPublished &&
    !SHOP_ROLES.includes(role) &&
    profile.categories.length === 0
  ) {
    throw new ProfileMissingCategoryError(t("missingCategory"));
  }

  // Every provider supplies a private detailed address plus a province and
  // ward before publishing. Public reads deliberately expose only the two
  // administrative names; the exact address remains available to the owner
  // and workflows that explicitly need it.
  if (
    isPublished &&
    (!profile.address?.trim() || !profile.provinceId || !profile.wardId)
  ) {
    throw new ProfileMissingLocationError(t("missingLocation"));
  }

  const updated = await db.profile.update({
    where: { id: profile.id },
    data: { isPublished },
  });

  // Publish state is the single biggest lever on what's public: it decides
  // whether this provider appears in /browse, the featured strip and their
  // own /profile/<username> page. Covers tryAutoPublish's callers too
  // (verification approved, a portfolio photo approved, categories saved).
  await revalidatePublicProfile(userId);

  return updated;
}

// The project owner's explicit call to drop the manual "Đang hoạt động"
// toggle (it read as a confusing extra step) — a profile now goes live
// on its own the moment every requirement is already met. Call this
// after anything that could complete the checklist: identity
// verification approved, a portfolio photo approved, or the profile's
// own categories/location saved. Silently no-ops via setProfilePublished's
// own checks when something is still missing — this isn't a user-
// initiated action, so there's no error to surface.
/** Returns whether the profile is public after the attempt. */
export async function tryAutoPublish(userId: string, role: Role) {
  try {
    await setProfilePublished(userId, role, true);
    return true;
  } catch {
    // Not ready yet.
    return false;
  }
}

async function getPublicProfileUserUncached(username: string) {
  const user = await db.user.findFirst({
    relationLoadStrategy: "join",
    // A suspended or soft-deleted account is not public even if its Profile
    // rows are still `isPublished` (suspension/deletion doesn't unpublish).
    where: { username, deletedAt: null, isSuspended: false },
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
      ward: {
        select: {
          name: true,
          province: { select: { name: true } },
        },
      },
      acceptingBookings: true,
      // Public "Thông tin xác minh" facts (redesign 09/2026): whether the
      // phone was verified - never the number - and the month they joined.
      phoneVerified: true,
      createdAt: true,
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
          province: { select: { name: true } },
          ward: {
            select: {
              name: true,
              province: { select: { name: true } },
            },
          },
          // Prompt B5, VIỆC 5 — public viewers only ever see moderated,
          // approved media. The owner's own view (dashboard/portfolio)
          // reads directly via db.profileMedia.findMany with no filter,
          // deliberately not through this function.
          //
          // take: 1 — this flat list's two consumers both want exactly
          // one photo: page.tsx's og:image, and the cover-banner fallback
          // (ProfileCover) that shows a provider's own best shot instead
          // of a brand gradient. The portfolio display itself reads
          // albums[].media below. Was fetching every approved photo on a
          // profile just to use the first one.
          media: {
            where: { moderationStatus: "APPROVED", deletedAt: null },
            orderBy: { order: "asc" },
            take: 1,
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
              // "Chụp tại" (services/places.ts) — shown only while the
              // spot is public; see the mapping below.
              place: {
                select: {
                  name: true,
                  slug: true,
                  reviewStatus: true,
                  deletedAt: true,
                  mergedIntoId: true,
                  province: { select: { code: true } },
                },
              },
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
          services: {
            where: { isActive: true },
            // The package's own picture. Its status comes along so the page
            // can drop a photo that is not approved (or was deleted) before
            // anything reaches the browser: see lib/media/package-photo.ts.
            include: {
              coverMedia: {
                select: {
                  url: true,
                  type: true,
                  moderationStatus: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      },
      // Only verificationStatus is actually used publicly (the Verified
      // badge) — the rest of UserRole (subscription, verification ID
      // fields) is never read from this query's result on the client side.
      // verifiedAt is shown as month/year only ("Đã xác minh 03/2025").
      roles: {
        select: { role: true, verificationStatus: true, verifiedAt: true },
      },
    },
  });

  if (!user) return user;

  return {
    ...user,
    profiles: user.profiles.map((profile) => {
      // Street-level address and the provider's post-booking Zalo contact
      // are private. Remove both at the public service boundary so a future
      // Client Component cannot expose them by spreading this object.
      const publicProfile = omitPrivateProfileFields(profile);

      return {
        ...publicProfile,
        // The one address that may be public, under its own name: a studio
        // that chose to show where it is. Null for everyone else.
        studioAddress: publicStudioAddress(profile),
        albums: profile.albums.map((album) => {
          const cover =
            album.coverMedia &&
            album.coverMedia.moderationStatus === "APPROVED" &&
            !album.coverMedia.deletedAt
              ? album.coverMedia
              : (album.media[0] ?? null);
          const place =
            album.place &&
            album.place.reviewStatus === "APPROVED" &&
            !album.place.deletedAt &&
            !album.place.mergedIntoId
              ? { name: album.place.name, href: placeHref(album.place) }
              : null;
          return {
            ...album,
            place,
            coverMedia: cover
              ? { id: cover.id, url: cover.url, type: cover.type }
              : null,
          };
        }),
      };
    }),
  };
}

// Public profile page data — published profiles, approved media, published
// albums. Fully visitor-independent (the owner's editing view reads albums
// separately via listAlbums). Cached ~90s, tagged by username so a mutation
// to this provider clears exactly this page (see revalidatePublicProfile).
// reviveDates() restores the Date fields that unstable_cache's JSON round-trip
// would otherwise hand back as strings (dateOfBirth -> getAgeRangeLabel).
export async function getPublicProfileUser(username: string) {
  const cached = unstable_cache(
    () => getPublicProfileUserUncached(username),
    [CACHE_KEY_VERSION, "public-profile", "user", username.toLowerCase()],
    { tags: [profileNameTag(username)], revalidate: CACHE_TTL.publicProfile },
  );
  return reviveDates(await cached());
}

// One published album of a published profile, read through the same cached
// public loader — so only approved photos ever come back. Shared by the
// album page and the quick-view lightbox (/api/albums/[id]/public).
export async function findPublicAlbum(username: string, albumId: string) {
  const user = await getPublicProfileUser(username);
  if (!user) return null;
  for (const profile of user.profiles) {
    const album = profile.albums.find((a) => a.id === albumId);
    if (album) {
      // The cover first (it is what the visitor pressed), then the rest in
      // the artist's order.
      const cover = album.coverMedia;
      const photos = [
        ...(cover ? album.media.filter((m) => m.id === cover.id) : []),
        ...album.media.filter((m) => m.id !== cover?.id),
      ];
      const bookingHref =
        PROVIDER_ROLES.includes(profile.role) && user.acceptingBookings
          ? `/booking/${user.id}`
          : null;
      return { user, profile, album, photos, bookingHref };
    }
  }
  return null;
}

export async function getProviderForBooking(providerId: string) {
  return db.user.findFirst({
    // A suspended provider can't take new bookings.
    where: {
      id: providerId,
      deletedAt: null,
      isSuspended: false,
      acceptingBookings: true,
    },
    select: {
      id: true,
      firstName: true,
      name: true,
      username: true,
      avatar: true,
      profiles: {
        where: { isPublished: true, role: { in: PROVIDER_ROLES } },
        select: {
          displayName: true,
          role: true,
          // Server-side only: the booking page rounds these to ~10 km for
          // golden-hour hints before anything reaches the browser.
          latitude: true,
          longitude: true,
          // Ward and province only, the same as the public profile shows.
          // The street address stays private (see Profile.address).
          ward: { select: { name: true } },
          province: { select: { name: true } },
          // For a studio that shows where it is: see publicStudioAddress().
          // Read here, decided on the server, never sent on as it is.
          address: true,
          hideExactLocation: true,
          // The provider's own terms, shown on the review step in place of
          // a platform-wide cancellation rule.
          depositPercent: true,
          depositPolicy: true,
          cancellationPolicy: true,
          reschedulePolicy: true,
          services: { where: { isActive: true }, orderBy: { price: "asc" } },
          // The booking flow's picture pane (wave 2): a few of the
          // artist's own approved photos, never stock imagery.
          media: {
            where: {
              type: "IMAGE",
              moderationStatus: "APPROVED",
              deletedAt: null,
            },
            orderBy: { order: "asc" },
            take: 6,
            select: { url: true },
          },
        },
      },
      roles: { select: { role: true, verificationStatus: true } },
    },
  });
}

// The true average/count/star-breakdown, independent of
// getProfileReviews' capped list below — page.tsx (star rating, JSON-LD
// aggregateRating) and ReviewsTab (the 5★..1★ bar chart) both read this
// instead of deriving from the fetched list, so neither goes wrong for
// a provider with more reviews than the display cap fetches.
async function getProfileReviewStatsUncached(userId: string) {
  const [agg, byRating] = await Promise.all([
    db.review.aggregate({
      where: { reviewedId: userId },
      _avg: { rating: true },
      _count: true,
    }),
    db.review.groupBy({
      by: ["rating"],
      where: { reviewedId: userId },
      _count: true,
    }),
  ]);
  const count = agg._count;
  const countByRating = new Map(byRating.map((r) => [r.rating, r._count]));
  const breakdown = [5, 4, 3, 2, 1].map((stars) => {
    const starCount = countByRating.get(stars) ?? 0;
    return {
      stars,
      count: starCount,
      percent: count > 0 ? Math.round((starCount / count) * 100) : 0,
    };
  });
  return { avgRating: agg._avg.rating ?? 0, count, breakdown };
}

async function getProfileReviewsUncached(userId: string) {
  return db.review.findMany({
    where: { reviewedId: userId },
    include: {
      reviewer: { select: { name: true, firstName: true, avatar: true } },
      // Which package the review is about ("Ảnh cưới ngoại cảnh · 20/09").
      booking: { select: { service: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    // No "load more" on the public reviews tab yet — was fetching every
    // review a heavily-reviewed provider had ever received on every
    // profile view. 50 is generous for what a viewer actually scrolls
    // through today.
    take: 50,
  });
}

// These two are per-provider public reads, cached ~90s and tagged
// `profile:user:<id>` so revalidatePublicProfile(userId) clears them on any
// review / profile / media / service / verification change. reviveDates()
// undoes the cache's Date -> ISO-string round-trip (review.createdAt is
// rendered with .toISOString() on the profile page).

export async function getProfileReviewStats(userId: string) {
  const cached = unstable_cache(
    () => getProfileReviewStatsUncached(userId),
    [CACHE_KEY_VERSION, "public-profile", "review-stats", userId],
    { tags: [profileUserTag(userId)], revalidate: CACHE_TTL.publicProfile },
  );
  return cached();
}

export async function getProfileReviews(userId: string) {
  const cached = unstable_cache(
    () => getProfileReviewsUncached(userId),
    [CACHE_KEY_VERSION, "public-profile", "reviews", userId],
    { tags: [profileUserTag(userId)], revalidate: CACHE_TTL.publicProfile },
  );
  return reviveDates(await cached());
}

// NOT cached. The shop tab only renders while MARKETPLACE_ENABLED is true,
// and product create/update/delete + order stock decrements are not wired
// into revalidatePublicProfile — caching this would serve stale inventory.
// Revisit together with the marketplace feature flag.
export async function getShopProducts(userId: string, role?: Role) {
  return db.product.findMany({
    where: {
      userId,
      isActive: true,
      deletedAt: null,
      ...(role && SHOP_ROLES.includes(role)
        ? {
            category: {
              in: productCategoryQueryValues(productCategoriesForRole(role)),
            },
          }
        : {}),
    },
    include: {
      images: {
        where: { moderationStatus: "APPROVED" },
        orderBy: { order: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Called only from POST /api/profiles/view, which owns the "is this actually
// a new view?" decision (cookie-based, one per browser per profile per day)
// and the owner check. Do not call this from a page — that is what made the
// counter tick on every refresh and every crawler fetch.
export function incrementProfileView(profileId: string) {
  // Fire-and-forget — never block the response on an analytics write.
  void db.profile
    .update({ where: { id: profileId }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}
