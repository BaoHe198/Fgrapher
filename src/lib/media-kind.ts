// Whether a stored media URL is a photo or a video, for the places that
// only ever kept a URL — Booking.referenceImages is a plain string[], and
// ServiceRequestReference stores mediaUrl without a type column. Portfolio
// media doesn't need this: ProfileMedia has its own `type`.
//
// Deliberately zero imports, like media-variants.ts, so it's safe from
// either a Server or a Client Component.

export type MediaKind = "IMAGE" | "VIDEO";

const VIDEO_EXTENSION = /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i;

export function mediaKindFromUrl(url: string): MediaKind {
  // Cloudinary puts the resource type in the delivery path, and it is the
  // authoritative answer: /video/upload/ vs /image/upload/. An uploaded
  // video can be delivered without an extension, so the path check comes
  // first and the extension is only a fallback for other hosts.
  if (url.includes("/video/upload/")) return "VIDEO";
  if (url.includes("/image/upload/")) return "IMAGE";
  return VIDEO_EXTENSION.test(url) ? "VIDEO" : "IMAGE";
}

// Only Cloudinary delivery URLs are accepted as reference media. Every
// legitimate upload path goes browser -> Cloudinary and stores the
// secure_url it returns, so anything else in these fields was typed into
// an API call by hand — and it would be rendered straight into another
// user's browser (the provider reading a booking). CSP would refuse most
// foreign hosts anyway; this refuses them before they are ever stored.
export function isCloudinaryDeliveryUrl(url: string): boolean {
  return url.startsWith("https://res.cloudinary.com/");
}
