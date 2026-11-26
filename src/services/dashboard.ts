import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { PROVIDER_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";
import { usesDaylight } from "@/lib/constants/booking-wording";
import { formatAdministrativeLocation } from "@/lib/location";
import { upcomingBookingFilter } from "@/lib/booking-window";
import { resolvePartyName } from "@/lib/party-name";
import { vietnamMonthStart } from "@/lib/vietnam/date";

// Midnight on the 1st of the current month in Vietnam — see
// vietnamMonthStart for why the server's own clock is not used.
const startOfMonthInVietnam = (now: Date) => vietnamMonthStart(now);

export interface ProviderStats {
  pending: number;
  /** Confirmed and not yet started — the shoots a provider has coming up. */
  upcoming: number;
  /** Completed this month (Vietnam time). */
  earnings: number;
  views: number;
}

export interface CustomerStats {
  /** Requests still waiting for the provider's answer. */
  pendingRequests: number;
  /** Confirmed and not yet started: the same count the bookings page shows. */
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
      where: { providerId: userId, ...upcomingBookingFilter(now) },
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
  const [pending, upcoming, savedArtists, unreadMessages, orders] =
    await Promise.all([
      // Counted apart from "upcoming": a request nobody has accepted is not a
      // booking yet. The two used to be added together here and nowhere else.
      db.booking.count({ where: { customerId: userId, status: "PENDING" } }),
      db.booking.count({
        where: { customerId: userId, ...upcomingBookingFilter(new Date()) },
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
    pendingRequests: pending,
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
        // The page name, as on the profile the customer booked from: the
        // feed said "Hoàng Nam" for "Nam Đặng Photography" (25/11/2026).
        provider: {
          select: {
            name: true,
            firstName: true,
            profiles: { select: { displayName: true, role: true } },
          },
        },
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
      // "" would print as a line ending in a dash, so it becomes null and
      // the page's own fallback word is used.
      personName:
        resolvePartyName(isProvider ? b.customer : b.provider, "").trim() ||
        null,
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

// ---------------------------------------------------------------------------
// Dashboard v2 (wave 2): what a provider's day looks like. Everything here
// is real data - no estimated response times, no view trend the database
// cannot draw (profile views are a running total, so only the requests
// chart compares this week with last).
// ---------------------------------------------------------------------------

function vietnamDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

export interface ProviderOverview {
  today: {
    id: string;
    startTime: string;
    endTime: string | null;
    service: string | null;
    customer: string;
    place: string | null;
  }[];
  pending: {
    id: string;
    customerId: string;
    customer: string;
    date: string;
    startTime: string;
    service: string | null;
    totalPrice: number | null;
    notes: string | null;
    /** "Phường X, Tỉnh Y", or "" at the provider's own place. */
    area: string;
    expiresAt: string | null;
  }[];
  sunPoint: { latitude: number; longitude: number } | null;
  /** Requests received per Vietnam day: index 0 = 13 days ago. */
  requestsByDay: number[];
  completedThisMonth: { count: number; value: number };
  views: number;
}

export async function getProviderOverview(
  userId: string,
): Promise<ProviderOverview> {
  const now = new Date();
  const todayKey = vietnamDayKey(now);
  const fortnightAgo = new Date(now.getTime() - 14 * 86_400_000);
  const startOfMonth = startOfMonthInVietnam(now);

  const [user, today, pending, recent, completed] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        avatar: true,
        coverImage: true,
        roles: { select: { role: true, verificationStatus: true } },
        profiles: {
          where: { role: { in: PROVIDER_ROLES } },
          select: {
            role: true,
            latitude: true,
            longitude: true,
            provinceId: true,
            viewCount: true,
            depositPolicy: true,
            cancellationPolicy: true,
            _count: {
              select: {
                services: { where: { isActive: true } },
                serviceAreas: true,
                // For the roll's "album" tile: has an album at all, and
                // has photos in one that are still in the review queue.
                albums: { where: { deletedAt: null } },
                media: {
                  where: {
                    deletedAt: null,
                    moderationStatus: "PENDING",
                    albumId: { not: null },
                  },
                },
              },
            },
            albums: {
              where: {
                deletedAt: null,
                isPublished: true,
                media: {
                  some: { moderationStatus: "APPROVED", deletedAt: null },
                },
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    }),
    db.booking.findMany({
      where: {
        providerId: userId,
        status: "CONFIRMED",
        date: new Date(`${todayKey}T00:00:00.000Z`),
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        locationAddress: true,
        service: { select: { name: true } },
        customer: { select: { name: true, firstName: true } },
      },
    }),
    db.booking.findMany({
      where: { providerId: userId, status: "PENDING" },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
      take: 6,
      select: {
        id: true,
        customerId: true,
        date: true,
        startTime: true,
        totalPrice: true,
        notes: true,
        expiresAt: true,
        locationProvince: { select: { name: true } },
        locationWard: { select: { name: true } },
        service: { select: { name: true } },
        customer: { select: { name: true, firstName: true } },
      },
    }),
    db.booking.findMany({
      where: { providerId: userId, createdAt: { gte: fortnightAgo } },
      select: { createdAt: true },
    }),
    db.booking.findMany({
      where: {
        providerId: userId,
        status: "COMPLETED",
        completedAt: { gte: startOfMonth },
      },
      select: { totalPrice: true },
    }),
  ]);

  const profiles = user.profiles;
  // Sunrise and golden hour on "today" only where daylight matters: a
  // make-up artist and a studio were shown them too.
  const located = profiles.find(
    (p) => usesDaylight(p.role) && p.latitude != null && p.longitude != null,
  );

  const dayKeys = Array.from({ length: 14 }, (_, i) =>
    vietnamDayKey(new Date(now.getTime() - (13 - i) * 86_400_000)),
  );
  const requestsByDay = dayKeys.map(
    (key) => recent.filter((b) => vietnamDayKey(b.createdAt) === key).length,
  );

  const name = (c: { name: string | null; firstName: string | null }) =>
    c.firstName ?? c.name ?? "";

  return {
    today: today.map((b) => ({
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      service: b.service?.name ?? null,
      customer: name(b.customer),
      place: b.locationAddress,
    })),
    pending: pending.map((b) => ({
      id: b.id,
      customerId: b.customerId,
      customer: name(b.customer),
      date: b.date.toISOString(),
      startTime: b.startTime,
      service: b.service?.name ?? null,
      totalPrice: b.totalPrice,
      notes: b.notes,
      area: formatAdministrativeLocation({
        ward: b.locationWard,
        province: b.locationProvince,
      }),
      expiresAt: b.expiresAt?.toISOString() ?? null,
    })),
    // ~10 km rounding, as on the public booking page.
    sunPoint: located
      ? {
          latitude: Math.round(located.latitude! * 10) / 10,
          longitude: Math.round(located.longitude! * 10) / 10,
        }
      : null,
    requestsByDay,
    completedThisMonth: {
      count: completed.length,
      value: completed.reduce((sum, b) => sum + (b.totalPrice ?? 0), 0),
    },
    views: profiles.reduce((sum, p) => sum + p.viewCount, 0),
  };
}
