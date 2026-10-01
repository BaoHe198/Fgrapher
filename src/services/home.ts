import type { ProfileCategory, Role } from "@prisma/client";

import { db } from "@/lib/db";
import {
  CACHE_KEY_VERSION,
  CACHE_TAGS,
  CACHE_TTL,
  reviveDates,
  unstable_cache,
} from "@/lib/cache";
import { splitVietnameseName } from "@/lib/vietnam/name";
import { PUBLIC_USER_FILTER, SEARCHABLE_ROLES } from "@/services/search";

// Reads for the landing page's redesign sections (09/2026): the "Bạn cần
// ai?" role tiles, "Duyệt theo phong cách" collages and the trust block.
// Every photo here is an APPROVED, not-deleted portfolio image of a
// published, public provider - the same bar the featured strip and the
// public profile already apply - so nothing reaches the home page that
// isn't already public elsewhere. The hero stays on the brand's own
// artwork (see the comment in app/(public)/page.tsx).
//
// Cached for the featured strip's TTL under the `search` tag, which every
// profile / media-moderation / review mutation already invalidates.

const PUBLIC_IMAGE_WHERE = {
  type: "IMAGE",
  moderationStatus: "APPROVED",
  deletedAt: null,
  profile: {
    isPublished: true,
    role: { in: SEARCHABLE_ROLES },
    user: PUBLIC_USER_FILTER,
  },
} as const;

/** Role tiles, in the order the design shows them. */
export const HOME_ROLES: Role[] = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "MODEL",
  "STUDIO",
  "COSTUME_SHOP",
];

/** Style collages, in the order the design shows them. */
export const HOME_STYLES: ProfileCategory[] = [
  "WEDDING",
  "PORTRAIT",
  "YEARBOOK",
  "EVENT",
  "FASHION",
  "PRODUCT",
];

export interface HomeRoleTile {
  role: Role;
  photoUrl: string | null;
}

export interface HomeStyleTile {
  category: ProfileCategory;
  photoUrls: string[];
}

export interface HomeReviewQuote {
  rating: number;
  content: string;
  reviewerName: string;
  createdAt: Date;
}

async function loadRoleTiles(): Promise<HomeRoleTile[]> {
  const roles = HOME_ROLES.filter((role) => SEARCHABLE_ROLES.includes(role));
  return Promise.all(
    roles.map(async (role) => {
      const media = await db.profileMedia.findFirst({
        where: {
          ...PUBLIC_IMAGE_WHERE,
          profile: { ...PUBLIC_IMAGE_WHERE.profile, role },
        },
        orderBy: { createdAt: "desc" },
        select: { url: true },
      });
      return { role, photoUrl: media?.url ?? null };
    }),
  );
}

async function loadStyleTiles(): Promise<HomeStyleTile[]> {
  return Promise.all(
    HOME_STYLES.map(async (category) => {
      // A photo counts for a style when its album is filed under it, or -
      // for photos outside any categorised album - when the provider lists
      // the style. `distinct` spreads the three frames across providers.
      const media = await db.profileMedia.findMany({
        where: {
          ...PUBLIC_IMAGE_WHERE,
          OR: [
            { album: { category, deletedAt: null, isPublished: true } },
            {
              album: null,
              profile: {
                ...PUBLIC_IMAGE_WHERE.profile,
                categories: { has: category },
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        distinct: ["profileId"],
        take: 3,
        select: { url: true },
      });
      return { category, photoUrls: media.map((m) => m.url) };
    }),
  );
}

async function loadReviewQuote(): Promise<HomeReviewQuote | null> {
  const review = await db.review.findFirst({
    where: {
      rating: { gte: 4 },
      content: { not: null },
      reviewer: { deletedAt: null, isSuspended: false },
      reviewed: PUBLIC_USER_FILTER,
    },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    select: {
      rating: true,
      content: true,
      createdAt: true,
      reviewer: { select: { name: true } },
    },
  });
  if (!review?.content) return null;
  // Given name only ("Thảo Vy", not "Trần Thảo Vy"): this is the front
  // page, and the reviewer wrote for the provider's profile.
  return {
    rating: review.rating,
    content: review.content,
    reviewerName: splitVietnameseName(review.reviewer.name ?? "").firstName,
    createdAt: review.createdAt,
  };
}

async function loadHomeShowcase() {
  const [roles, styles, review, provinceCount] = await Promise.all([
    loadRoleTiles(),
    loadStyleTiles(),
    loadReviewQuote(),
    db.province.count(),
  ]);
  return { roles, styles, review, provinceCount };
}

const getHomeShowcaseCached = unstable_cache(
  loadHomeShowcase,
  [CACHE_KEY_VERSION, "home", "showcase"],
  { tags: [CACHE_TAGS.search], revalidate: CACHE_TTL.featured },
);

export async function getHomeShowcase() {
  return reviveDates(await getHomeShowcaseCached());
}

// ---------------------------------------------------------------------------
// Giới thiệu F (wave 2): a 12-frame contact sheet, two rolls of the six
// roles in HOME_ROLES order - 01A-01F the newest photo of each role, 02A-02F
// the next one, from a different provider where there is one. Same public
// bar as the rest of this file; an empty slot stays empty (null), it is
// never filled with stock imagery.
// ---------------------------------------------------------------------------

export interface AboutFrame {
  role: Role;
  url: string | null;
  width: number | null;
  height: number | null;
}

async function loadAboutFrames(): Promise<AboutFrame[]> {
  const perRole = await Promise.all(
    HOME_ROLES.map((role) =>
      db.profileMedia.findMany({
        where: {
          ...PUBLIC_IMAGE_WHERE,
          profile: { ...PUBLIC_IMAGE_WHERE.profile, role },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { url: true, width: true, height: true, profileId: true },
      }),
    ),
  );
  // The second roll prefers another provider, else that provider's next photo.
  const picks = perRole.map((rows) => {
    const first = rows[0];
    const second =
      rows.find((row) => first && row.profileId !== first.profileId) ?? rows[1];
    return [first, second];
  });
  return [0, 1].flatMap((roll) =>
    HOME_ROLES.map((role, i) => {
      const media = picks[i][roll];
      return {
        role,
        url: media?.url ?? null,
        width: media?.width ?? null,
        height: media?.height ?? null,
      };
    }),
  );
}

const getAboutFramesCached = unstable_cache(
  loadAboutFrames,
  [CACHE_KEY_VERSION, "home", "about-frames"],
  { tags: [CACHE_TAGS.search], revalidate: CACHE_TTL.featured },
);

export async function getAboutFrames() {
  return getAboutFramesCached();
}
