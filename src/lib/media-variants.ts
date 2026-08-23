// Deliberately zero imports (not even from lib/cloudinary.ts, which
// imports the Node-only `cloudinary` SDK and would break if bundled into
// a Client Component). Pure string manipulation, safe from either side.

export interface MediaVariants {
  thumbnail: string;
  medium: string;
  large: string;
}

const VARIANT_WIDTHS = { thumbnail: 400, medium: 1200, large: 2000 } as const;

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
    return { thumbnail: url, medium: url, large: url };
  }

  const insertAt = index + marker.length;
  const build = (width: number) =>
    `${url.slice(0, insertAt)}c_limit,w_${width},f_webp,q_auto/${url.slice(insertAt)}`;

  return {
    thumbnail: build(VARIANT_WIDTHS.thumbnail),
    medium: build(VARIANT_WIDTHS.medium),
    large: build(VARIANT_WIDTHS.large),
  };
}
