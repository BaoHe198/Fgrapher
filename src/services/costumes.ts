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

/** Everything the shop itself sees, approved photo or not. */
export async function listCostumesForOwner(profileId: string) {
  return db.costumeItem.findMany({
    where: { profileId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: COSTUME_SELECT,
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
    select: COSTUME_SELECT,
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
