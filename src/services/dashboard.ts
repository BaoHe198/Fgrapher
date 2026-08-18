import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { PROVIDER_ROLES } from "@/lib/constants";

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
  return roles.some((role) => PROVIDER_ROLES.includes(role) || role === "CAMERA_SHOP");
}

export async function getProviderStats(userId: string): Promise<ProviderStats> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pending, confirmed, completedThisMonth, profiles] = await Promise.all([
    db.booking.count({ where: { providerId: userId, status: "PENDING" } }),
    db.booking.count({
      where: { providerId: userId, status: "CONFIRMED", date: { gte: startOfMonth } },
    }),
    db.booking.findMany({
      where: { providerId: userId, status: "COMPLETED", completedAt: { gte: startOfMonth } },
      select: { totalPrice: true },
    }),
    db.profile.findMany({ where: { userId }, select: { viewCount: true } }),
  ]);

  return {
    pending,
    confirmed,
    earnings: completedThisMonth.reduce((sum, b) => sum + (b.totalPrice ?? 0), 0),
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
    db.order.count({ where: { customerId: userId } }),
  ]);

  return { upcomingBookings: upcoming, savedArtists, messages: unreadMessages, orders };
}

export interface RecentActivityItem {
  id: string;
  type: "booking" | "message" | "review";
  text: string;
  timestamp: Date;
}

export async function getRecentActivity(
  userId: string,
  isProvider: boolean,
): Promise<RecentActivityItem[]> {
  const bookingWhere = isProvider ? { providerId: userId } : { customerId: userId };

  const [bookings, messages, reviews] = await Promise.all([
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
  ]);

  const items: RecentActivityItem[] = [
    ...bookings.map((b) => ({
      id: `booking-${b.id}`,
      type: "booking" as const,
      text: isProvider
        ? `Booking ${b.status.toLowerCase()} — ${b.customer.firstName ?? b.customer.name ?? "A client"}`
        : `Booking ${b.status.toLowerCase()} — ${b.provider.firstName ?? b.provider.name ?? "A provider"}`,
      timestamp: b.updatedAt,
    })),
    ...messages.map((m) => ({
      id: `message-${m.id}`,
      type: "message" as const,
      text: `New message from ${m.sender.firstName ?? m.sender.name ?? "Someone"}`,
      timestamp: m.createdAt,
    })),
    ...reviews.map((r) => ({
      id: `review-${r.id}`,
      type: "review" as const,
      text: `New ${r.rating}★ review from ${r.reviewer.firstName ?? r.reviewer.name ?? "A client"}`,
      timestamp: r.createdAt,
    })),
  ];

  return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
}
