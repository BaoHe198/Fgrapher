/**
 * The picture a provider chose for a package, or null when there is none to
 * show.
 *
 * A photo that has not been approved, or has been deleted, is never public
 * (CLAUDE.md rule 8). The package card then falls back to a portfolio photo
 * picked by position, as it did before a picture could be chosen. Decided
 * on the server: the page passes the browser this URL or nothing, never the
 * unapproved photo's own URL.
 */
export function packagePhotoUrl(
  coverMedia: {
    url: string;
    type: string;
    moderationStatus: string;
    deletedAt: Date | string | null;
  } | null,
): string | null {
  if (!coverMedia) return null;
  if (coverMedia.type !== "IMAGE") return null;
  if (coverMedia.moderationStatus !== "APPROVED" || coverMedia.deletedAt) {
    return null;
  }
  return coverMedia.url;
}
