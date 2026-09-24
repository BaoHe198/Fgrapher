import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { PROVIDER_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";

/** Vietnam is UTC+7 all year — no daylight saving to account for. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Bookings that have not started yet.
 *
 * startAt, not date: `date` is the calendar day at 00:00, so `date >= now`
 * dropped a booking for later today out of "upcoming" from midnight onwards
 * — on exactly the day it matters most. startAt is nullable on rows that
 * predate it, so those fall back to the calendar day in Vietnam time (a
 * @db.Date compares as UTC midnight).
 */
function notStartedYet(now: Date) {
  const todayInVietnam = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(now);
  return [
    { startAt: { gte: now } },
    { startAt: null, date: { gte: new Date(todayInVietnam) } },
  ];
}

/**
 * Midnight on the 1st of the current month in Vietnam, as an instant.
 * setDate(1)/setHours(0) used the server's clock — UTC on Vercel — so the
 * month started seven hours late and a job finished at 06:00 on the 1st
 * Vietnam time was counted in the previous month.
 */
function startOfMonthInVietnam(now: Date) {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return new Date(
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - VN_OFFSET_MS,
  );
}

export interface ProviderStats {
  pending: number;
  /** Confirmed and not yet started — the shoots a provider has coming up. */
  upcoming: number;
  /** Completed this month (Vietnam time). */
  earnings: number;
  views: number;
}

export interface CustomerStats {
  upcomingBookings: number;
  savedArtists: number;
  messages: number;
  orders: number;
}

export interface CostumeShopStats {
  /** Unread messages — for a shop that rents through chat, these are the
   * enquiries. */
  unreadMessages: number;
  activeCostumes: number;
  views: number;
}

/**
 * A costume shop is not in PROVIDER_ROLES — it takes no bookings — so it
 * used to fall through to the customer's numbers: upcoming bookings, saved
 * artists, orders. None of those says anything to someone running a rental
 * shop. These are the three that do.
 */
export async function getCostumeShopStats(
  userId: string,
): Promise<CostumeShopStats> {
  const [unreadMessages, activeCostumes, profile] = await Promise.all([
    db.message.count({ where: { receiverId: userId, readAt: null } }),
    db.costumeItem.count({
      where: {
        profile: { userId, role: "COSTUME_SHOP" },
        isActive: true,
        deletedAt: null,
      },
    }),
    db.profile.findUnique({
      where: { userId_role: { userId, role: "COSTUME_SHOP" } },
      select: { viewCount: true },
    }),
  ]);
  return {
    unreadMessages,
    activeCostumes,
    views: profile?.viewCount ?? 0,
  };
}

export interface CameraShopStats {
  /** Pending or confirmed — orders still waiting on the shop to act. */
  ordersToHandle: number;
  activeListings: number;
  unreadMessages: number;
  views: number;
}

/**
 * Same story as the costume shop: CAMERA_SHOP sells on Chợ F rather than
 * taking bookings, and without its own numbers it saw a customer's —
 * including "orders", meaning orders it had *placed*, not received.
 */
export async function getCameraShopStats(
  userId: string,
): Promise<CameraShopStats> {
  const [ordersToHandle, activeListings, unreadMessages, profile] =
    await Promise.all([
      db.order.count({
        where: { shopId: userId, status: { in: ["PENDING", "CONFIRMED"] } },
      }),
      db.product.count({
        where: { userId, isActive: true, deletedAt: null },
      }),
      db.message.count({ where: { receiverId: userId, readAt: null } }),
      db.profile.findUnique({
        where: { userId_role: { userId, role: "CAMERA_SHOP" } },
        select: { viewCount: true },
      }),
    ]);
  return {
    ordersToHandle,
    activeListings,
    unreadMessages,
    views: profile?.viewCount ?? 0,
  };
}

export function isProviderRoleSet(roles: Role[]) {
  return roles.some((role) => PROVIDER_ROLES.includes(role));
}

export async function getProviderStats(userId: string): Promise<ProviderStats> {
  const now = new Date();
  const startOfMonth = startOfMonthInVietnam(now);

  const [pending, upcoming, completedThisMonth, profiles] = await Promise.all([
    db.booking.count({ where: { providerId: userId, status: "PENDING" } }),
    // Was "confirmed with a date this month", which counted shoots already
    // done earlier in the month and none from next month — a number that
    // answered no question a provider asks. "What have I got coming up?"
    db.booking.count({
      where: {
        providerId: userId,
        status: "CONFIRMED",
        OR: notStartedYet(now),
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
    upcoming,
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
        OR: notStartedYet(new Date()),
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
//
// `href` is resolved here rather than in the page because this is the only
// place that still has the underlying row id: the activity list used to be
// plain text, so "Booking pending — Mai Hương" was something a customer
// could read but not open.
export type RecentActivityItem =
  | {
      id: string;
      type: "booking";
      href: string;
      timestamp: Date;
      status: string;
      personName: string | null;
    }
  | {
      id: string;
      type: "message";
      href: string;
      timestamp: Date;
      personName: string | null;
    }
  | {
      id: string;
      type: "review";
      href: string;
      timestamp: Date;
      personName: string | null;
      rating: number;
    }
  | {
      id: string;
      type: "order";
      href: string;
      timestamp: Date;
      status: string;
      personName: string | null;
    }
  | {
      id: string;
      type: "album";
      href: string;
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

  const [bookings, messages, reviews, albums, orders] = await Promise.all([
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
    // Orders this user has *received* as a seller. Without these a shop
    // with an order waiting on it read "no activity yet" directly under a
    // card saying "orders to handle: 1".
    features.marketplaceEnabled
      ? db.order.findMany({
          where: { shopId: userId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: { customer: { select: { name: true, firstName: true } } },
        })
      : Promise.resolve([]),
  ]);

  const items: RecentActivityItem[] = [
    ...bookings.map((b) => ({
      id: `booking-${b.id}`,
      type: "booking" as const,
      href: `/dashboard/bookings/${b.id}`,
      status: b.status,
      personName: isProvider
        ? (b.customer.firstName ?? b.customer.name)
        : (b.provider.firstName ?? b.provider.name),
      timestamp: b.updatedAt,
    })),
    ...messages.map((m) => ({
      id: `message-${m.id}`,
      type: "message" as const,
      href: "/dashboard/messages",
      personName: m.sender.firstName ?? m.sender.name,
      timestamp: m.createdAt,
    })),
    ...reviews.map((r) => ({
      id: `review-${r.id}`,
      type: "review" as const,
      href: "/dashboard/reviews",
      personName: r.reviewer.firstName ?? r.reviewer.name,
      rating: r.rating,
      timestamp: r.createdAt,
    })),
    ...orders.map((o) => ({
      id: `order-${o.id}`,
      type: "order" as const,
      href: "/dashboard/shop-orders",
      status: o.status,
      personName: o.customer.firstName ?? o.customer.name,
      timestamp: o.updatedAt,
    })),
    ...albums.map((a) => ({
      id: `album-${a.id}`,
      type: "album" as const,
      href: "/dashboard/portfolio",
      albumTitle: a.title,
      timestamp: a.createdAt,
    })),
  ];

  return items
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);
}
