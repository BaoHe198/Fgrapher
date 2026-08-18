import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";

export async function getPublicProfileUser(username: string) {
  return db.user.findUnique({
    where: { username, deletedAt: null },
    include: {
      profiles: {
        where: { isPublished: true, role: { in: PAID_ROLES } },
        include: {
          media: { orderBy: { order: "asc" } },
          services: { where: { isActive: true } },
        },
      },
    },
  });
}

export async function getProviderForBooking(providerId: string) {
  return db.user.findUnique({
    where: { id: providerId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      name: true,
      avatar: true,
      profiles: {
        where: { isPublished: true, role: { in: PAID_ROLES } },
        select: {
          role: true,
          services: { where: { isActive: true }, orderBy: { price: "asc" } },
        },
      },
    },
  });
}

export async function getProfileReviews(userId: string) {
  return db.review.findMany({
    where: { reviewedId: userId },
    include: { reviewer: { select: { name: true, firstName: true, avatar: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getShopProducts(userId: string) {
  return db.product.findMany({
    where: { userId, isActive: true, deletedAt: null },
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
}

export function incrementProfileView(profileId: string) {
  // Fire-and-forget — never block the page render on an analytics write.
  void db.profile.update({ where: { id: profileId }, data: { viewCount: { increment: 1 } } }).catch(() => {});
}
