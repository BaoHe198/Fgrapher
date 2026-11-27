// Deliberately zero imports (not even from lib/media/cloudinary.ts, which
// imports the Node-only `cloudinary` SDK and would break if bundled into
// a Client Component). Pure string manipulation, safe from either side.

export interface MediaVariants {
  thumbnail: string;
  medium: string;
  large: string;
  // Data minimisation for the tier-1 scan (lib/openai-moderation.ts): the
  // third-party classifier is sent THIS, never the original. 512px is
  // ample for "is this sexual/graphic" while being far too small to be
  // useful for identifying anyone, and a Cloudinary-transformed derivative
  // carries no EXIF — so no GPS coordinates, camera serial, or capture
  // timestamp crosses the border with it. See
  // docs/ops/content-moderation.md.
  moderation: string;
}

const VARIANT_WIDTHS = {
  thumbnail: 400,
  medium: 1200,
  large: 2000,
  moderation: 512,
} as const;

// Avatars are drawn in circles of 24 to 132 CSS pixels, but the stored URL
// is the original upload. Until 27/11/2026 every avatar on screen was
// fetched at that original size: on the one real provider profile that was a
// 1.18 MB PNG for a 96px circle, more than half the page's weight. 256px
// covers a 64px avatar on a 3x phone and a 128px one on a 2x screen; the two
// large placements (profile hero, "about" card) ask for more.
export const AVATAR_DELIVERY_WIDTH = 256;
export const AVATAR_DELIVERY_WIDTH_LARGE = 400;

/**
 * The delivery URL for an avatar: the same picture, resized by Cloudinary to
 * at most `width` pixels wide and re-encoded as WebP.
 *
 * Anything that is not a plain Cloudinary upload URL comes back untouched: a
 * Google account photo, a `blob:` preview of a file not uploaded yet, and a
 * URL that already carries a transformation.
 */
export function buildAvatarUrl(
  url: string,
  width: number = AVATAR_DELIVERY_WIDTH,
): string {
  if (!url.includes("res.cloudinary.com/")) return url;
  const marker = "/image/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return url;

  const insertAt = index + marker.length;
  const rest = url.slice(insertAt);
  // Right after "/upload/" comes either the version ("v1788165459"), the
  // folder, or a transformation ("c_limit,w_1200"). Only the last has the
  // "<1-3 letters>_<value>" shape, and it must not be stacked on.
  const first = rest.split("/")[0] ?? "";
  if (!/^v\d+$/.test(first) && /^[a-z]{1,3}_/.test(first)) return url;

  return `${url.slice(0, insertAt)}c_limit,w_${Math.round(width)},f_webp,q_auto/${rest}`;
}

// Derives thumbnail/medium/large WebP delivery URLs from an already-
// uploaded image's URL (Prompt B5, VIỆC 3, docs/guides/
// fgrapher-danh-gia-va-prompt-sua-doi.md). Cloudinary delivery URLs
// accept an arbitrary transformation segment right after "/upload/"; this
// doesn't need credentials, just the URL shape every Cloudinary upload
// response already has.
export function buildMediaVariants(url: string): MediaVariants {
  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (index === -1) {
    // Not a recognizable Cloudinary delivery URL (e.g. a mocked test
    // fixture) — fall back to the original rather than returning garbage.
    return { thumbnail: url, medium: url, large: url, moderation: url };
  }

  const insertAt = index + marker.length;
  const build = (width: number) =>
    `${url.slice(0, insertAt)}c_limit,w_${width},f_webp,q_auto/${url.slice(insertAt)}`;

  return {
    thumbnail: build(VARIANT_WIDTHS.thumbnail),
    medium: build(VARIANT_WIDTHS.medium),
    large: build(VARIANT_WIDTHS.large),
    moderation: build(VARIANT_WIDTHS.moderation),
  };
}
