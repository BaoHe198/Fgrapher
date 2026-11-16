import { db } from "@/lib/db";
import { publicPhotoWhere } from "@/services/search";

// "Bảng ý tưởng" (owner, 16/11/2026): single photos a signed-in visitor
// pins, to send an artist as the brief. See SavedMedia in schema.prisma.
//
// A photo can be pinned only while it is public, and the board is read
// through the same public filter every time - a photo that is later
// rejected, trashed or unpublished drops off every board without anyone
// having to clean up, and the board can never show what search would not.

/** Enough for a brief; keeps one account from hoarding the catalogue. */
export const MOODBOARD_LIMIT = 200;

export class MoodboardPhotoNotFoundError extends Error {}
export class MoodboardFullError extends Error {}

export async function pinPhoto(userId: string, mediaId: string) {
  const photo = await db.profileMedia.findFirst({
    where: { ...publicPhotoWhere(), id: mediaId },
    select: { id: true },
  });
  if (!photo) throw new MoodboardPhotoNotFoundError("Photo is not public");

  const existing = await db.savedMedia.findUnique({
    where: { userId_mediaId: { userId, mediaId } },
    select: { id: true },
  });
  if (existing) return existing;

  const count = await db.savedMedia.count({ where: { userId } });
  if (count >= MOODBOARD_LIMIT) {
    throw new MoodboardFullError("Board is full");
  }
  return db.savedMedia.create({
    data: { userId, mediaId },
    select: { id: true },
  });
}

export async function unpinPhoto(userId: string, mediaId: string) {
  await db.savedMedia.deleteMany({ where: { userId, mediaId } });
}

/** Ids of every photo on the board, public or not - for pin-button state. */
export async function listPinnedIds(userId: string) {
  const rows = await db.savedMedia.findMany({
    where: { userId },
    select: { mediaId: true },
  });
  return rows.map((row) => row.mediaId);
}

/** The board itself: only photos that are still public, newest pin first. */
export async function getMoodboard(userId: string) {
  const rows = await db.savedMedia.findMany({
    where: { userId, media: publicPhotoWhere() },
    orderBy: { createdAt: "desc" },
    select: {
      mediaId: true,
      media: {
        select: {
          url: true,
          width: true,
          height: true,
          album: { select: { title: true } },
          profile: {
            select: {
              role: true,
              displayName: true,
              userId: true,
              user: { select: { name: true, username: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.mediaId,
    url: row.media.url,
    width: row.media.width,
    height: row.media.height,
    albumTitle: row.media.album?.title ?? null,
    artistId: row.media.profile.userId,
    artistName:
      row.media.profile.displayName ?? row.media.profile.user.name ?? null,
    artistUsername: row.media.profile.user.username,
    role: row.media.profile.role,
  }));
}

export type MoodboardPhoto = Awaited<ReturnType<typeof getMoodboard>>[number];
