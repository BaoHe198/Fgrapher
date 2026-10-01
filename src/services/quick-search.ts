import { Prisma, type Role } from "@prisma/client";

import { db } from "@/lib/db";
import { formatAdministrativeLocation } from "@/lib/location";
import {
  escapeLike,
  foldVietnamese,
  SQL_FOLD_FROM,
  SQL_FOLD_TO,
} from "@/lib/vietnam/fold";
import { PUBLIC_USER_FILTER, SEARCHABLE_ROLES } from "@/services/search";

// The ⌘K palette (wave 2 kit §04): a handful of artists and albums for
// whatever is typed, accent-insensitive, every word required ("da nang"
// matches "Đà Nẵng", "minh da nang" needs both). Unlike /browse it also
// matches where the artist is based, since that is how people look for
// someone: a name or a place. Small and uncached - the palette debounces.

const ARTIST_LIMIT = 4;
const ALBUM_LIMIT = 3;
const MAX_WORDS = 5;

function words(q: string) {
  return foldVietnamese(q)
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, MAX_WORDS);
}

/** Every word as `folded LIKE %word%`, joined with AND. */
function everyWord(column: Prisma.Sql, list: string[]) {
  return Prisma.join(
    list.map((word) => Prisma.sql`${column} LIKE ${`%${escapeLike(word)}%`}`),
    " AND ",
  );
}

const fold = (expr: Prisma.Sql) =>
  Prisma.sql`lower(translate(${expr}, ${SQL_FOLD_FROM}, ${SQL_FOLD_TO}))`;

export interface QuickSearchArtist {
  username: string;
  name: string;
  avatar: string | null;
  roles: Role[];
  location: string;
}

export interface QuickSearchAlbum {
  id: string;
  title: string;
  username: string;
  providerName: string;
}

export async function quickSearch(q: string): Promise<{
  artists: QuickSearchArtist[];
  albums: QuickSearchAlbum[];
}> {
  const list = words(q);
  if (list.length === 0) return { artists: [], albums: [] };

  const profileText = fold(
    Prisma.sql`concat_ws(' ', p."displayName", p."shopName", u.name, u.username, w.name, pv.name, wp.name)`,
  );
  const albumText = fold(
    Prisma.sql`concat_ws(' ', a.title, p."displayName", p."shopName", u.name)`,
  );

  const [profileRows, albumRows] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`
      SELECT p.id
      FROM profiles p
      JOIN users u ON u.id = p."userId"
      LEFT JOIN wards w ON w.id = p."wardId"
      LEFT JOIN provinces wp ON wp.id = w."provinceId"
      LEFT JOIN provinces pv ON pv.id = p."provinceId"
      WHERE ${everyWord(profileText, list)}
      LIMIT 40
    `,
    db.$queryRaw<{ id: string }[]>`
      SELECT a.id
      FROM albums a
      JOIN profiles p ON p.id = a."profileId"
      JOIN users u ON u.id = p."userId"
      WHERE ${everyWord(albumText, list)}
      LIMIT 20
    `,
  ]);

  const publicProfile = {
    isPublished: true,
    role: { in: SEARCHABLE_ROLES },
    user: PUBLIC_USER_FILTER,
  } satisfies Prisma.ProfileWhereInput;

  const [profiles, albums] = await Promise.all([
    db.profile.findMany({
      where: { id: { in: profileRows.map((row) => row.id) }, ...publicProfile },
      orderBy: { updatedAt: "desc" },
      select: {
        role: true,
        displayName: true,
        shopName: true,
        userId: true,
        user: { select: { name: true, username: true, avatar: true } },
        province: { select: { name: true } },
        ward: {
          select: { name: true, province: { select: { name: true } } },
        },
      },
    }),
    db.album.findMany({
      where: {
        id: { in: albumRows.map((row) => row.id) },
        isPublished: true,
        deletedAt: null,
        media: {
          some: {
            type: "IMAGE",
            moderationStatus: "APPROVED",
            deletedAt: null,
          },
        },
        profile: publicProfile,
      },
      orderBy: { updatedAt: "desc" },
      take: ALBUM_LIMIT,
      select: {
        id: true,
        title: true,
        profile: {
          select: {
            displayName: true,
            shopName: true,
            user: { select: { name: true, username: true } },
          },
        },
      },
    }),
  ]);

  // One row per person, the way /browse shows them.
  const byUser = new Map<string, QuickSearchArtist>();
  for (const profile of profiles) {
    const existing = byUser.get(profile.userId);
    if (existing) {
      existing.roles.push(profile.role);
      continue;
    }
    if (byUser.size >= ARTIST_LIMIT) continue;
    byUser.set(profile.userId, {
      // PUBLIC_USER_FILTER guarantees a username.
      username: profile.user.username ?? "",
      name: profile.displayName ?? profile.shopName ?? profile.user.name ?? "",
      avatar: profile.user.avatar,
      roles: [profile.role],
      location: formatAdministrativeLocation(profile),
    });
  }

  return {
    artists: [...byUser.values()],
    albums: albums.map((album) => ({
      id: album.id,
      title: album.title,
      username: album.profile.user.username ?? "",
      providerName:
        album.profile.displayName ??
        album.profile.shopName ??
        album.profile.user.name ??
        "",
    })),
  };
}
