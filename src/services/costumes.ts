import type { ModerationStatus } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * A costume item's photo goes through the ordinary portfolio moderation
 * queue (CLAUDE.md rule 8), so the public profile must not show an outfit
 * whose photo has not been approved yet. The owner still sees it in their
 * own dashboard, with the photo's status, so they know why it is not live.
 */
const PUBLIC_MEDIA_STATUS: ModerationStatus = "APPROVED";

const COSTUME_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  rentalPricePerDay: true,
  depositAmount: true,
  size: true,
  color: true,
  isActive: true,
  sortOrder: true,
  media: {
    select: {
      id: true,
      url: true,
      width: true,
      height: true,
      moderationStatus: true,
    },
  },
} as const;

/** The outfit's further photos, in portfolio order. */
const GALLERY_ORDER = { order: "asc" } as const;

/**
 * Sets an outfit's further photos to exactly `mediaIds`: links those,
 * unlinks any other photo that was linked to it. The caller has already
 * checked the ids are the profile's own photos; `profileId` is repeated in
 * the write so a wrong id can never touch another profile's row.
 */
export async function setCostumeGallery(
  tx: Pick<typeof db, "profileMedia">,
  costumeItemId: string,
  profileId: string,
  mediaIds: string[],
) {
  await tx.profileMedia.updateMany({
    where: { costumeItemId, id: { notIn: mediaIds } },
    data: { costumeItemId: null },
  });
  if (mediaIds.length > 0) {
    await tx.profileMedia.updateMany({
      where: { id: { in: mediaIds }, profileId },
      data: { costumeItemId },
    });
  }
}

/** Everything the shop itself sees, approved photo or not. */
export async function listCostumesForOwner(profileId: string) {
  return db.costumeItem.findMany({
    where: { profileId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      ...COSTUME_SELECT,
      // The shop sees every further photo with its review status.
      gallery: {
        where: { deletedAt: null },
        orderBy: GALLERY_ORDER,
        select: { id: true, url: true, moderationStatus: true },
      },
    },
  });
}

/**
 * What a visitor sees: active items only, and an item with a photo attached
 * only once that photo is approved. An item with no photo at all is shown —
 * a shop may list an outfit before photographing it.
 */
export async function listPublicCostumes(profileId: string) {
  const items = await db.costumeItem.findMany({
    where: {
      profileId,
      deletedAt: null,
      isActive: true,
      OR: [
        { mediaId: null },
        { media: { moderationStatus: PUBLIC_MEDIA_STATUS, deletedAt: null } },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      ...COSTUME_SELECT,
      // Further photos reach a visitor one by one as each is approved; an
      // unapproved one is simply not in the list (CLAUDE.md rule 8).
      gallery: {
        where: { deletedAt: null, moderationStatus: PUBLIC_MEDIA_STATUS },
        orderBy: GALLERY_ORDER,
        select: { id: true, url: true },
      },
    },
  });
  return items;
}

/** Returns the item only when it belongs to the given user. */
export async function findOwnedCostume(id: string, userId: string) {
  const item = await db.costumeItem.findUnique({
    where: { id },
    include: { profile: { select: { userId: true, role: true } } },
  });
  if (!item || item.deletedAt || item.profile.userId !== userId) return null;
  return item;
}

/** Soft delete, matching ProfileMedia's contract — never a hard delete. */
export async function softDeleteCostume(id: string) {
  return db.costumeItem.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
