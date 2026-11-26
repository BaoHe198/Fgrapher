import { db } from "@/lib/db";

/**
 * Which of `ids` are live photos belonging to this profile.
 *
 * Anything a provider attaches a photo to by id (an outfit, a package) must
 * check the id is their own: without this, someone could put another
 * provider's photo on their own listing by sending its id. Deleted photos
 * and videos do not count.
 */
export async function ownPhotoIds(
  profileId: string,
  ids: string[],
): Promise<Set<string>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return new Set();
  const rows = await db.profileMedia.findMany({
    where: {
      id: { in: wanted },
      profileId,
      type: "IMAGE",
      deletedAt: null,
    },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}
