import type { ProfileCategory, Role } from "@prisma/client";

import { ROLE_PHOTOS, STYLE_PHOTOS } from "@/lib/constants/showcase-images";
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
// The tiles, collages and the About sheet show fixed showcase artwork
// (lib/constants/showcase-images.ts, owner 08/10/2026), never a provider's
// upload; only the review quote and province count are read here.
//
// Cached for the featured strip's TTL under the `search` tag, which every
// review mutation already invalidates.

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
  photoUrl: string;
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

type ShowcaseRole = keyof typeof ROLE_PHOTOS;
type ShowcaseStyle = keyof typeof STYLE_PHOTOS;

function loadRoleTiles(): HomeRoleTile[] {
  return HOME_ROLES.filter((role) => SEARCHABLE_ROLES.includes(role)).map(
    (role) => ({ role, photoUrl: ROLE_PHOTOS[role as ShowcaseRole][0].src }),
  );
}

function loadStyleTiles(): HomeStyleTile[] {
  return HOME_STYLES.map((category) => ({
    category,
    photoUrls: STYLE_PHOTOS[category as ShowcaseStyle].map((p) => p.src),
  }));
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
  const [review, provinceCount] = await Promise.all([
    loadReviewQuote(),
    db.province.count(),
  ]);
  return { review, provinceCount };
}

const getHomeShowcaseCached = unstable_cache(
  loadHomeShowcase,
  [CACHE_KEY_VERSION, "home", "showcase-quote"],
  { tags: [CACHE_TAGS.search], revalidate: CACHE_TTL.featured },
);

export async function getHomeShowcase() {
  return {
    ...reviveDates(await getHomeShowcaseCached()),
    roles: loadRoleTiles(),
    styles: loadStyleTiles(),
  };
}

// ---------------------------------------------------------------------------
// Giới thiệu F (wave 2): a 12-photo sheet, two rows of the six roles in
// HOME_ROLES order - the role tile's photo, then a second showcase photo.
// ---------------------------------------------------------------------------

export interface AboutFrame {
  role: Role;
  url: string | null;
  width: number | null;
  height: number | null;
}

export async function getAboutFrames(): Promise<AboutFrame[]> {
  return [0, 1].flatMap((row) =>
    HOME_ROLES.map((role) => {
      const photo = ROLE_PHOTOS[role as ShowcaseRole][row];
      return {
        role,
        url: photo?.src ?? null,
        width: photo?.width ?? null,
        height: photo?.height ?? null,
      };
    }),
  );
}
