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
  return withTransformation(
    url,
    `c_limit,w_${Math.round(width)},f_webp,q_auto`,
  );
}

// The photo frame of a map marker is 44 CSS pixels square; 132 covers a 3x
// phone. Until 27/11/2026 each frame fetched the provider's newest portfolio
// photo as uploaded: on the live home page that was 300 KB for one 44px
// frame, where the same picture at this size is under 2 KB.
export const MAP_MARKER_DELIVERY_SIZE = 132;

/**
 * The delivery URL for a small square thumbnail: cropped to a square around
 * the centre (what `object-cover` shows anyway), `size` pixels a side, WebP.
 *
 * For a plain `<img>` only — one drawn outside next/image, such as a map
 * marker. Like buildAvatarUrl, anything that is not a plain Cloudinary image
 * upload comes back untouched.
 */
export function buildSquareThumbUrl(url: string, size: number): string {
  const side = Math.round(size);
  return withTransformation(url, `c_fill,w_${side},h_${side},f_webp,q_auto`);
}

/**
 * `url` with a Cloudinary transformation put in, or `url` itself when it is
 * not a plain Cloudinary image upload: a Google account photo, a `blob:`
 * preview of a file not uploaded yet, a video, or a URL that already carries
 * a transformation.
 */
function withTransformation(url: string, transformation: string): string {
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

  return `${url.slice(0, insertAt)}${transformation}/${rest}`;
}

// Derives thumbnail/medium/large WebP delivery URLs from an already-
// uploaded image's URL (Prompt B5, VIỆC 3, docs/guides/
// fgrapher-danh-gia-va-prompt-sua-doi.md). Cloudinary delivery URLs
// accept an arbitrary transformation segment right after "/upload/"; this
// doesn't need credentials, just the URL shape every Cloudinary upload
// response already has.
export function buildMediaVariants(url: string): MediaVariants {
  return {
    thumbnail: atWidth(url, VARIANT_WIDTHS.thumbnail),
    medium: atWidth(url, VARIANT_WIDTHS.medium),
    large: atWidth(url, VARIANT_WIDTHS.large),
    moderation: atWidth(url, VARIANT_WIDTHS.moderation),
  };
}

// `url` resized by Cloudinary to at most `width` pixels wide, as WebP. Not a
// recognizable Cloudinary delivery URL (a mocked test fixture, a local
// file): the original comes back rather than garbage.
function atWidth(url: string, width: number): string {
  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return url;
  const insertAt = index + marker.length;
  return `${url.slice(0, insertAt)}c_limit,w_${width},f_webp,q_auto/${url.slice(insertAt)}`;
}

// The widths a photo is delivered at when the browser chooses by screen
// (components/ui/cloudinary-image.tsx). Few on purpose: every width is one
// more derived copy the image host makes and keeps for each photo. 400, 1200
// and 2000 are the thumbnail, medium and large above; 800 is the step that
// was missing between a tile and a full-width photo.
export const DELIVERY_WIDTHS = [400, 800, 1200, 2000] as const;
export type DeliveryWidth = (typeof DELIVERY_WIDTHS)[number];

// A copy up to this much narrower than the slot still counts as covering
// it: stretched by a few per cent a photo looks the same. It is what lets a
// 412px phone at 2x (824 device pixels, the commonest Android size) take
// the 800px copy for a full-width photo instead of the 1200px one, more
// than twice the bytes.
const COVER_TOLERANCE = 0.9;

/** The smallest stock width that covers `width`, and never above `max`. */
export function deliveryWidthFor(
  width: number,
  max: DeliveryWidth = 2000,
): DeliveryWidth {
  for (const stock of DELIVERY_WIDTHS) {
    if (stock >= max) return max;
    if (stock >= width * COVER_TOLERANCE) return stock;
  }
  return max;
}

/**
 * The delivery URL for a photo in a slot `width` device pixels wide: the
 * smallest stock copy that fills it, capped at `max`.
 *
 * Until 28/11/2026 a photo drawn outside the image optimiser was always
 * fetched at one fixed size, 1200 or 2000 pixels wide, whatever the screen.
 * On the live Tìm kiếm F that was 69 KB for a card that a typical phone
 * fills with the 21 KB copy.
 */
export function buildSizedMediaUrl(
  url: string,
  width: number,
  max: DeliveryWidth = 2000,
): string {
  return atWidth(url, deliveryWidthFor(width, max));
}
