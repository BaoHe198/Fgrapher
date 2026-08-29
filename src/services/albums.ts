import { db } from "@/lib/db";
import {
  deleteCloudinaryAsset,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

// Prompt G3 (docs/guides/fgrapher-prompt-dot-2.md) — the album layer on
// top of the previously-flat ProfileMedia list. Trash/restore behavior
// per the project owner's decision: deleting an album (or a single
// photo) soft-deletes it, recoverable for TRASH_TTL_DAYS, then a cron
// (purgeExpiredTrash, called from /api/cron/purge-trashed-media)
// permanently removes it — same shape as the existing KYC-document purge.
export const TRASH_TTL_DAYS = 7;

export class AlbumNotFoundError extends Error {}
export class AlbumNotOwnedError extends Error {}

async function assertOwnsAlbum(albumId: string, userId: string) {
  const album = await db.album.findUnique({
    where: { id: albumId },
    include: { profile: { select: { userId: true } } },
  });
  if (!album) throw new AlbumNotFoundError("Album not found");
  if (album.profile.userId !== userId) {
    throw new AlbumNotOwnedError("You don't own this album");
  }
  return album;
}

export async function listAlbums(profileId: string) {
  const albums = await db.album.findMany({
    where: { profileId, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      coverMedia: { select: { id: true, url: true, type: true } },
      _count: { select: { media: { where: { deletedAt: null } } } },
    },
  });

  // Fall back to the first (lowest `order`) photo as the cover when none
  // was explicitly chosen — matches how a flat portfolio grid used to
  // just show every photo, so a fresh album still looks populated.
  const albumsNeedingFallbackCover = albums.filter((a) => !a.coverMedia);
  const fallbackCovers = albumsNeedingFallbackCover.length
    ? await db.profileMedia.findMany({
        where: {
          albumId: { in: albumsNeedingFallbackCover.map((a) => a.id) },
          deletedAt: null,
        },
        orderBy: { order: "asc" },
        distinct: ["albumId"],
        select: { albumId: true, id: true, url: true, type: true },
      })
    : [];
  const fallbackByAlbum = new Map(fallbackCovers.map((m) => [m.albumId, m]));

  return albums.map((album) => ({
    ...album,
    coverMedia: album.coverMedia ?? fallbackByAlbum.get(album.id) ?? null,
  }));
}

export async function createAlbum(
  profileId: string,
  data: {
    title: string;
    description?: string;
    category: string;
    shootDate?: string;
  },
) {
  const maxOrder = await db.album.aggregate({
    where: { profileId, deletedAt: null },
    _max: { sortOrder: true },
  });

  return db.album.create({
    data: {
      profileId,
      title: data.title,
      description: data.description,
      category: data.category as never,
      shootDate: data.shootDate ? new Date(data.shootDate) : undefined,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
}

export async function getAlbumWithMedia(albumId: string) {
  return db.album.findUnique({
    where: { id: albumId, deletedAt: null },
    include: {
      media: { where: { deletedAt: null }, orderBy: { order: "asc" } },
    },
  });
}

export async function updateAlbum(
  albumId: string,
  userId: string,
  data: {
    title?: string;
    description?: string | null;
    category?: string;
    shootDate?: string | null;
    coverMediaId?: string | null;
    isPublished?: boolean;
  },
) {
  await assertOwnsAlbum(albumId, userId);

  return db.album.update({
    where: { id: albumId },
    data: {
      ...data,
      category: data.category as never,
      shootDate:
        data.shootDate === undefined
          ? undefined
          : data.shootDate === null
            ? null
            : new Date(data.shootDate),
    },
  });
}

export async function reorderAlbums(
  profileId: string,
  userId: string,
  order: string[],
) {
  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile || profile.userId !== userId) {
    throw new AlbumNotOwnedError("You don't own this profile");
  }

  await db.$transaction(
    order.map((id, index) =>
      db.album.update({
        where: { id, profileId },
        data: { sortOrder: index },
      }),
    ),
  );
}

// Prompt G3, VIỆC 2 — deletes the album AND every photo inside it
// together, stamped with the SAME deletedAt so restoreAlbum can tell
// "deleted as part of this album" apart from "was already individually
// trashed earlier" (see restoreAlbum's comment).
export async function deleteAlbum(albumId: string, userId: string) {
  await assertOwnsAlbum(albumId, userId);
  const deletedAt = new Date();

  await db.$transaction([
    db.album.update({ where: { id: albumId }, data: { deletedAt } }),
    db.profileMedia.updateMany({
      where: { albumId, deletedAt: null },
      data: { deletedAt },
    }),
  ]);
}

export async function restoreAlbum(albumId: string, userId: string) {
  const album = await db.album.findUnique({
    where: { id: albumId },
    include: { profile: { select: { userId: true } } },
  });
  if (!album) throw new AlbumNotFoundError("Album not found");
  if (album.profile.userId !== userId) {
    throw new AlbumNotOwnedError("You don't own this album");
  }
  if (!album.deletedAt) return album;

  await db.$transaction([
    db.album.update({ where: { id: albumId }, data: { deletedAt: null } }),
    // Only photos deleted at the exact same instant as the album itself
    // — a photo the provider had already individually trashed BEFORE
    // deleting the whole album should stay trashed, not get resurrected
    // as a side effect.
    db.profileMedia.updateMany({
      where: { albumId, deletedAt: album.deletedAt },
      data: { deletedAt: null },
    }),
  ]);

  return album;
}

export async function restoreMedia(mediaId: string, userId: string) {
  const media = await db.profileMedia.findUnique({
    where: { id: mediaId },
    include: { profile: { select: { userId: true } } },
  });
  if (!media || media.profile.userId !== userId) {
    throw new AlbumNotFoundError("Photo not found");
  }
  return db.profileMedia.update({
    where: { id: mediaId },
    data: { deletedAt: null },
  });
}

export async function listTrash(profileId: string, userId: string) {
  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile || profile.userId !== userId) {
    throw new AlbumNotOwnedError("You don't own this profile");
  }

  const [albums, media] = await Promise.all([
    db.album.findMany({
      where: { profileId, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    }),
    // Only photos NOT already covered by a trashed album (that whole
    // album already surfaces its photo count in the album row above —
    // showing them again individually here would double-count). A photo
    // trashed individually while its album stays live keeps its
    // `albumId`, so "no album" alone isn't the right test — it has to be
    // "no album, OR its album isn't itself trashed".
    db.profileMedia.findMany({
      where: {
        profileId,
        deletedAt: { not: null },
        OR: [{ albumId: null }, { album: { deletedAt: null } }],
      },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  return { albums, media };
}

// Called by /api/cron/purge-trashed-media — permanently removes anything
// past the recovery window, including the underlying Cloudinary asset.
export async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000);

  const expiredMedia = await db.profileMedia.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true, publicId: true, type: true },
  });

  for (const media of expiredMedia) {
    if (media.publicId && isCloudinaryConfigured()) {
      await deleteCloudinaryAsset(
        media.publicId,
        media.type === "VIDEO" ? "video" : "image",
      ).catch(() => {});
    }
  }

  const [mediaDeleted, albumsDeleted] = await Promise.all([
    db.profileMedia.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    db.album.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
  ]);

  return {
    mediaDeleted: mediaDeleted.count,
    albumsDeleted: albumsDeleted.count,
  };
}
