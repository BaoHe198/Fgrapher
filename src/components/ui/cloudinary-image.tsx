"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

import { type DeliveryWidth, buildSizedMediaUrl } from "@/lib/media/variants";

// One loader per ceiling, made once: next/image compares the loader by
// identity, so a new function on every render would be a new image.
const LOADERS: Record<DeliveryWidth, (props: ImageLoaderProps) => string> = {
  400: ({ src, width }) => buildSizedMediaUrl(src, width, 400),
  800: ({ src, width }) => buildSizedMediaUrl(src, width, 800),
  1200: ({ src, width }) => buildSizedMediaUrl(src, width, 1200),
  2000: ({ src, width }) => buildSizedMediaUrl(src, width, 2000),
};

interface CloudinaryImageProps extends Omit<
  ImageProps,
  "src" | "loader" | "unoptimized"
> {
  /** The photo as stored (the original upload URL), not a resized copy. */
  src: string;
  /**
   * The widest copy this slot may ever ask for. 1200 for a card or a tile,
   * 2000 for a photo shown as wide as the screen.
   */
  maxWidth?: DeliveryWidth;
}

/**
 * An uploaded photo delivered by the image host at the width this screen
 * needs, instead of one fixed size for every device.
 *
 * It is next/image with the image host as its resizer: the browser gets a
 * `srcset` of the stock widths and picks by `sizes` and pixel density, so
 * `sizes` must say how wide the slot is. Use it in place of
 * `<Image unoptimized src={buildMediaVariants(url).medium}>`, which sent the
 * same 1200px copy to a 200px tile and to a full-width hero alike.
 *
 * A function cannot be passed from a Server Component to next/image, which
 * is why the loader lives in this small client file; a server page renders
 * this component like any other.
 */
export function CloudinaryImage({
  maxWidth = 1200,
  alt,
  ...props
}: CloudinaryImageProps) {
  return <Image {...props} alt={alt} loader={LOADERS[maxWidth]} />;
}
