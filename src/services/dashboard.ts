import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { PROVIDER_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";

export interface ProviderStats {
  pending: number;
  confirmed: number;
  earnings: number;
  views: number;
}

export interface CustomerStats {
  upcomingBookings: number;
  savedArtists: number;
  messages: number;
  orders: number;
}

export function isProviderRoleSet(roles: Role[]) {
  return roles.some(
    (role) => PROVIDER_ROLES.includes(role) || role === "CAMERA_SHOP",
  );
}

export async function getProviderStats(userId: string): Promise<ProviderStats> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pending, confirmed, completedThisMonth, profiles] = await Promise.all([
    db.booking.count({ where: { providerId: userId, status: "PENDING" } }),
    db.booking.count({
      where: {
        providerId: userId,
        status: "CONFIRMED",
        date: { gte: startOfMonth },
      },
    }),
    db.booking.findMany({
      where: {
        providerId: userId,
        status: "COMPLETED",
        completedAt: { gte: startOfMonth },
      },
      select: { totalPrice: true },
    }),
    db.profile.findMany({ where: { userId }, select: { viewCount: true } }),
  ]);

  return {
    pending,
    confirmed,
    earnings: completedThisMonth.reduce(
      (sum, b) => sum + (b.totalPrice ?? 0),
      0,
    ),
    views: profiles.reduce((sum, p) => sum + p.viewCount, 0),
  };
}

export async function getCustomerStats(userId: string): Promise<CustomerStats> {
  const [upcoming, savedArtists, unreadMessages, orders] = await Promise.all([
    db.booking.count({
      where: {
        customerId: userId,
        status: { in: ["PENDING", "CONFIRMED"] },
        date: { gte: new Date() },
      },
    }),
    db.savedProfile.count({ where: { userId } }),
    db.message.count({ where: { receiverId: userId, readAt: null } }),
    // Skipped while MARKETPLACE_ENABLED=false — the dashboard doesn't show
    // this card at all in that case (see dashboard/page.tsx).
    features.marketplaceEnabled
      ? db.order.count({ where: { customerId: userId } })
      : Promise.resolve(0),
  ]);

  return {
    upcomingBookings: upcoming,
    savedArtists,
    messages: unreadMessages,
    orders,
  };
}

// Text is built by the caller via next-intl (a page component, not this
// data-layer service) — each variant carries the raw params a template
// needs to interpolate, not pre-rendered English strings.
export type RecentActivityItem =
  | {
      id: string;
      type: "booking";
      timestamp: Date;
      status: string;
      personName: string | null;
    }
  | {
      id: string;
      type: "message";
      timestamp: Date;
      personName: string | null;
    }
  | {
      id: string;
      type: "review";
      timestamp: Date;
      personName: string | null;
      rating: number;
    }
  | {
      id: string;
      type: "album";
      timestamp: Date;
      albumTitle: string;
    };

export async function getRecentActivity(
  userId: string,
  isProvider: boolean,
): Promise<RecentActivityItem[]> {
  const bookingWhere = isProvider
    ? { providerId: userId }
    : { customerId: userId };

  const [bookings, messages, reviews, albums] = await Promise.all([
    db.booking.findMany({
      where: bookingWhere,
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        customer: { select: { name: true, firstName: true } },
        provider: { select: { name: true, firstName: true } },
      },
    }),
    db.message.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { sender: { select: { name: true, firstName: true } } },
    }),
    isProvider
      ? db.review.findMany({
          where: { reviewedId: userId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { reviewer: { select: { name: true, firstName: true } } },
        })
      : Promise.resolve([]),
    // Providers only — a customer has no Profile/Album rows of their own.
    isProvider
      ? db.album.findMany({
          where: { profile: { userId }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, title: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const items: RecentActivityItem[] = [
    ...bookings.map((b) => ({
      id: `booking-${b.id}`,
      type: "booking" as const,
      status: b.status,
      personName: isProvider
        ? (b.customer.firstName ?? b.customer.name)
        : (b.provider.firstName ?? b.provider.name),
      timestamp: b.updatedAt,
    })),
    ...messages.map((m) => ({
      id: `message-${m.id}`,
      type: "message" as const,
      personName: m.sender.firstName ?? m.sender.name,
      timestamp: m.createdAt,
    })),
    ...reviews.map((r) => ({
      id: `review-${r.id}`,
      type: "review" as const,
      personName: r.reviewer.firstName ?? r.reviewer.name,
      rating: r.rating,
      timestamp: r.createdAt,
    })),
    ...albums.map((a) => ({
      id: `album-${a.id}`,
      type: "album" as const,
      albumTitle: a.title,
      timestamp: a.createdAt,
    })),
  ];

  return items
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);
}
