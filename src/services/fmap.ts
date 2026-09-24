import { createHmac } from "node:crypto";

import type { BookingStatus, Prisma, ServiceKind } from "@prisma/client";

import { MIN_NOTICE_HOURS } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  blocksForProviders,
  weeklyWindowsForProviders,
} from "@/services/resource-calendar";
import type { FmapSearchInput } from "@/lib/validations/fmap";
import { joinVietnameseName } from "@/lib/vietnamese-name";
import { timeToMinutes } from "@/services/availability";

export const MAX_FMAP_MARKERS = 250;
export const PROVINCE_BOUNDS_PADDING_DEG = 0.05; // ~5 km
// Largest blur offset (650 m) plus headroom, in degrees of latitude. The DB
// query is widened by this much so that blurred markers whose private point
// sits just outside the viewport are still considered.
const BLUR_MARGIN_DEG = 0.007;
const MAX_SPATIAL_CANDIDATES = 600;
const DEFAULT_BOOKING_MINUTES = 60;
const BLOCKING_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

type TimeRange = { startTime: string; endTime: string };
type BlockingBooking = {
  startTime: string;
  endTime: string | null;
  service: { duration: number } | null;
};

export interface ProviderAvailabilityInput {
  date: string;
  start: string;
  end: string;
  weeklyWindows: TimeRange[];
  blockedDate?: { startTime: string | null; endTime: string | null };
  bookings: BlockingBooking[];
  now?: Date;
}

export interface FmapMarker {
  profileId: string;
  providerId: string;
  username: string | null;
  displayName: string;
  avatar: string | null;
  role: FmapSearchInput["roles"][number];
  categories: string[];
  startingPrice: number | null;
  currency: string;
  latitude: number;
  longitude: number;
}

export interface FmapProviderPreview {
  profileId: string;
  providerId: string;
  username: string | null;
  displayName: string;
  avatar: string | null;
  coverUrl: string | null;
  role: FmapMarker["role"];
  /** What they can be hired for, beyond what the role is called. */
  serviceKinds: ServiceKind[];
  categories: string[];
  startingPrice: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number;
  location: string | null;
  description: string | null;
  services: {
    id: string;
    name: string;
    price: number;
    currency: string;
    duration: number;
  }[];
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return startA < endB && endA > startB;
}

export function isProviderAvailableForInterval(
  input: ProviderAvailabilityInput,
): boolean {
  const requestedStart = timeToMinutes(input.start);
  const requestedEnd = timeToMinutes(input.end);
  const now = input.now ?? new Date();
  const requestedInstant = Date.parse(`${input.date}T${input.start}:00.000Z`);

  if (requestedInstant < now.getTime() + MIN_NOTICE_HOURS * 60 * 60 * 1000)
    return false;

  const fitsWeeklyWindow = input.weeklyWindows.some(
    (window) =>
      requestedStart >= timeToMinutes(window.startTime) &&
      requestedEnd <= timeToMinutes(window.endTime),
  );
  if (!fitsWeeklyWindow) return false;

  if (input.blockedDate) {
    const { startTime, endTime } = input.blockedDate;
    if (startTime == null || endTime == null) return false;
    if (
      rangesOverlap(
        requestedStart,
        requestedEnd,
        timeToMinutes(startTime),
        timeToMinutes(endTime),
      )
    ) {
      return false;
    }
  }

  return !input.bookings.some((booking) => {
    const bookingStart = timeToMinutes(booking.startTime);
    const bookingEnd = booking.endTime
      ? timeToMinutes(booking.endTime)
      : bookingStart + (booking.service?.duration ?? DEFAULT_BOOKING_MINUTES);
    return rangesOverlap(
      requestedStart,
      requestedEnd,
      bookingStart,
      bookingEnd,
    );
  });
}

/**
 * Returns a stable public point a few hundred metres from the private service
 * address. The database query always uses the exact point; only the response
 * is transformed. A keyed HMAC prevents someone from reversing the offset.
 */
export function obfuscateCoordinates(
  profileId: string,
  latitude: number,
  longitude: number,
  secret = process.env.NEXTAUTH_SECRET,
): { latitude: number; longitude: number } {
  if (!secret)
    throw new Error(
      "NEXTAUTH_SECRET is required to protect provider coordinates",
    );

  const digest = createHmac("sha256", secret)
    .update(`fmap:${profileId}`)
    .digest();
  const angle = (digest.readUInt32BE(0) / 0xffffffff) * Math.PI * 2;
  // Uniform by area between 300 m and 650 m, avoiding a revealing fixed ring.
  const unit = digest.readUInt32BE(4) / 0xffffffff;
  const radiusMetres = Math.sqrt(300 ** 2 + unit * (650 ** 2 - 300 ** 2));
  const northMetres = Math.cos(angle) * radiusMetres;
  const eastMetres = Math.sin(angle) * radiusMetres;
  const latitudeOffset = northMetres / 111_320;
  const longitudeScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
  const longitudeOffset = eastMetres / (111_320 * longitudeScale);

  return {
    latitude: latitude + latitudeOffset,
    longitude: longitude + longitudeOffset,
  };
}

function distanceSquaredFromCentre(
  latitude: number,
  longitude: number,
  input: FmapSearchInput,
) {
  const centreLatitude = (input.north + input.south) / 2;
  const centreLongitude = (input.east + input.west) / 2;
  const longitudeScale = Math.cos((centreLatitude * Math.PI) / 180);
  return (
    (latitude - centreLatitude) ** 2 +
    ((longitude - centreLongitude) * longitudeScale) ** 2
  );
}

function roleVerificationFilter(
  roles: FmapSearchInput["roles"],
): Prisma.ProfileWhereInput[] {
  return roles.map((role) => ({
    role,
    user: {
      roles: {
        some: { role, active: true, verificationStatus: "VERIFIED" },
      },
    },
  }));
}

/**
 * Profiles that may appear on Fmap for the given roles, before any
 * location or availability check. Shared by the search, the area bounds
 * and the per-ward counts so the three can never disagree.
 */
function fmapEligibleWhere(
  roles: FmapSearchInput["roles"],
): Prisma.ProfileWhereInput {
  return {
    isPublished: true,
    geocodingStatus: "READY",
    latitude: { not: null },
    longitude: { not: null },
    OR: roleVerificationFilter(roles),
    user: { deletedAt: null, isSuspended: false, acceptingBookings: true },
  };
}

export async function findAvailableProvidersOnMap(
  input: FmapSearchInput,
  viewerUserId?: string,
): Promise<{ markers: FmapMarker[]; truncated: boolean }> {
  const date = new Date(`${input.date}T00:00:00.000Z`);
  const dayOfWeek = date.getUTCDay();
  const lngMargin =
    BLUR_MARGIN_DEG /
    Math.max(
      Math.cos((((input.north + input.south) / 2) * Math.PI) / 180),
      0.1,
    );

  const found = await db.profile.findMany({
    where: {
      ...fmapEligibleWhere(input.roles),
      latitude: {
        not: null,
        gte: input.south - BLUR_MARGIN_DEG,
        lte: input.north + BLUR_MARGIN_DEG,
      },
      longitude: {
        not: null,
        gte: input.west - lngMargin,
        lte: input.east + lngMargin,
      },
      ...(input.wardId ? { wardId: input.wardId } : {}),
      ...(input.categories.length > 0
        ? { categories: { hasSome: input.categories } }
        : {}),
      ...(viewerUserId ? { userId: { not: viewerUserId } } : {}),
    },
    select: {
      id: true,
      userId: true,
      role: true,
      displayName: true,
      categories: true,
      priceMin: true,
      currency: true,
      hideExactLocation: true,
      latitude: true,
      longitude: true,
      user: {
        select: {
          username: true,
          name: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
    },
    orderBy: { id: "asc" },
    take: MAX_SPATIAL_CANDIDATES + 1,
  });

  // Viewport membership is decided on the PUBLIC point only. Filtering on
  // the private point let anyone shrink the box around a blurred provider
  // until it pinpointed their real address.
  const candidates = found
    .map((profile) => ({
      ...profile,
      publicPoint: profile.hideExactLocation
        ? obfuscateCoordinates(
            profile.id,
            profile.latitude!,
            profile.longitude!,
          )
        : { latitude: profile.latitude!, longitude: profile.longitude! },
    }))
    .filter(
      ({ publicPoint }) =>
        publicPoint.latitude >= input.south &&
        publicPoint.latitude <= input.north &&
        publicPoint.longitude >= input.west &&
        publicPoint.longitude <= input.east,
    );

  const spatiallyTruncated = found.length > MAX_SPATIAL_CANDIDATES;
  const boundedCandidates = candidates.slice(0, MAX_SPATIAL_CANDIDATES);
  if (boundedCandidates.length === 0) return { markers: [], truncated: false };

  const providerIds = [
    ...new Set(boundedCandidates.map((profile) => profile.userId)),
  ];
  const [weeklyWindows, blockedDates, bookings] = await Promise.all([
    weeklyWindowsForProviders(providerIds, dayOfWeek),
    blocksForProviders(providerIds, date),
    db.booking.findMany({
      where: {
        providerId: { in: providerIds },
        date,
        status: { in: BLOCKING_BOOKING_STATUSES },
      },
      select: {
        providerId: true,
        startTime: true,
        endTime: true,
        service: { select: { duration: true } },
      },
    }),
  ]);

  const weeklyByProvider = new Map<string, TimeRange[]>();
  for (const window of weeklyWindows) {
    const values = weeklyByProvider.get(window.userId) ?? [];
    values.push(window);
    weeklyByProvider.set(window.userId, values);
  }
  const blockByProvider = new Map(
    blockedDates.map((block) => [block.userId, block]),
  );
  const bookingsByProvider = new Map<string, BlockingBooking[]>();
  for (const booking of bookings) {
    const values = bookingsByProvider.get(booking.providerId) ?? [];
    values.push(booking);
    bookingsByProvider.set(booking.providerId, values);
  }

  const available = boundedCandidates
    .filter((profile) =>
      isProviderAvailableForInterval({
        date: input.date,
        start: input.start,
        end: input.end,
        weeklyWindows: weeklyByProvider.get(profile.userId) ?? [],
        blockedDate: blockByProvider.get(profile.userId),
        bookings: bookingsByProvider.get(profile.userId) ?? [],
      }),
    )
    .sort(
      (a, b) =>
        distanceSquaredFromCentre(
          a.publicPoint.latitude,
          a.publicPoint.longitude,
          input,
        ) -
        distanceSquaredFromCentre(
          b.publicPoint.latitude,
          b.publicPoint.longitude,
          input,
        ),
    );

  const markers = available.slice(0, MAX_FMAP_MARKERS).map((profile) => {
    const fullName = joinVietnameseName(
      profile.user.firstName,
      profile.user.lastName,
    );

    return {
      profileId: profile.id,
      providerId: profile.userId,
      username: profile.user.username,
      displayName:
        (profile.displayName ?? profile.user.name ?? fullName) ||
        "Fgrapher provider",
      avatar: profile.user.avatar,
      role: profile.role as FmapMarker["role"],
      categories: profile.categories,
      startingPrice: profile.priceMin,
      currency: profile.currency,
      ...profile.publicPoint,
    };
  });

  return {
    markers,
    truncated: spatiallyTruncated || available.length > MAX_FMAP_MARKERS,
  };
}

export async function getFmapProviderPreview(
  profileId: string,
): Promise<FmapProviderPreview | null> {
  const profile = await db.profile.findFirst({
    where: {
      id: profileId,
      isPublished: true,
      geocodingStatus: "READY",
      user: {
        deletedAt: null,
        isSuspended: false,
        acceptingBookings: true,
      },
    },
    select: {
      id: true,
      userId: true,
      role: true,
      serviceKinds: true,
      displayName: true,
      description: true,
      categories: true,
      priceMin: true,
      currency: true,
      province: { select: { name: true } },
      ward: { select: { name: true } },
      media: {
        where: { moderationStatus: "APPROVED", deletedAt: null },
        orderBy: { order: "asc" },
        take: 1,
        select: { url: true },
      },
      services: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        take: 3,
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          duration: true,
        },
      },
      user: {
        select: {
          username: true,
          name: true,
          firstName: true,
          lastName: true,
          avatar: true,
          roles: {
            where: { active: true, verificationStatus: "VERIFIED" },
            select: { role: true },
          },
        },
      },
    },
  });

  if (
    !profile ||
    !profile.user.roles.some((entry) => entry.role === profile.role)
  ) {
    return null;
  }

  const reviewStats = await db.review.aggregate({
    where: { reviewedId: profile.userId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const fullName = joinVietnameseName(
    profile.user.firstName,
    profile.user.lastName,
  );
  const location = [profile.ward?.name, profile.province?.name]
    .filter(Boolean)
    .join(", ");

  return {
    profileId: profile.id,
    providerId: profile.userId,
    serviceKinds: profile.serviceKinds,
    username: profile.user.username,
    displayName:
      profile.displayName ??
      profile.user.name ??
      (fullName || "Fgrapher provider"),
    avatar: profile.user.avatar,
    coverUrl: profile.media[0]?.url ?? null,
    role: profile.role as FmapMarker["role"],
    categories: profile.categories,
    startingPrice: profile.priceMin,
    currency: profile.currency,
    rating: reviewStats._avg.rating,
    reviewCount: reviewStats._count._all,
    location: location || null,
    description: profile.description?.slice(0, 220) ?? null,
    services: profile.services,
  };
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Bounding box around a set of private points, padded by
 * PROVINCE_BOUNDS_PADDING_DEG and rounded outward to 2 decimals. The padding
 * and rounding matter: a province with a single provider would otherwise
 * return that provider's exact service address as a zero-size box.
 */
export function paddedBounds(
  points: { latitude: number; longitude: number }[],
): MapBounds | null {
  if (points.length === 0) return null;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const pad = PROVINCE_BOUNDS_PADDING_DEG;
  return {
    north: Math.ceil((Math.max(...latitudes) + pad) * 100) / 100,
    south: Math.floor((Math.min(...latitudes) - pad) * 100) / 100,
    east: Math.ceil((Math.max(...longitudes) + pad) * 100) / 100,
    west: Math.floor((Math.min(...longitudes) - pad) * 100) / 100,
  };
}

/**
 * Where a province's Fmap providers are, for customers who pick a province
 * instead of sharing GPS. Provinces carry no coordinates of their own, so
 * the box is derived from the providers themselves; null means the province
 * has nobody on the map yet.
 */
export async function getProvinceProviderBounds(
  provinceId: string,
  wardId: string | undefined,
  roles: FmapSearchInput["roles"],
): Promise<MapBounds | null> {
  const result = await db.profile.aggregate({
    where: {
      ...fmapEligibleWhere(roles),
      provinceId,
      ...(wardId ? { wardId } : {}),
    },
    _min: { latitude: true, longitude: true },
    _max: { latitude: true, longitude: true },
  });
  const { _min: min, _max: max } = result;
  if (
    min.latitude == null ||
    min.longitude == null ||
    max.latitude == null ||
    max.longitude == null
  ) {
    return null;
  }
  return paddedBounds([
    { latitude: min.latitude, longitude: min.longitude },
    { latitude: max.latitude, longitude: max.longitude },
  ]);
}

/**
 * How many Fmap-eligible providers of the given roles each ward of a
 * province has, so the ward picker only offers wards that can return
 * something. Wards without providers are simply absent.
 */
export async function getWardProviderCounts(
  provinceId: string,
  roles: FmapSearchInput["roles"],
): Promise<{ wardId: string; count: number }[]> {
  const groups = await db.profile.groupBy({
    by: ["wardId"],
    where: { ...fmapEligibleWhere(roles), provinceId, wardId: { not: null } },
    _count: { _all: true },
  });
  return groups.flatMap((group) =>
    group.wardId ? [{ wardId: group.wardId, count: group._count._all }] : [],
  );
}
