import { db } from "@/lib/db";
import {
  CACHE_KEY_VERSION,
  CACHE_TTL,
  profileUserTag,
  unstable_cache,
} from "@/lib/cache";
import { medianMinutes } from "@/lib/response-time";

// Facts on the public profile that are computed, never typed in by the
// provider (redesign 09/2026): how many shoots they have completed on the
// platform, and how quickly they usually answer a booking request.
// Self-reported facts (years of experience, deposit policy) live on
// Profile instead.

/** Answered requests from this far back count toward the response time. */
const RESPONSE_WINDOW_DAYS = 180;

async function loadProfileStats(userId: string) {
  const since = new Date(Date.now() - RESPONSE_WINDOW_DAYS * 86_400_000);
  const [completedShoots, answered] = await Promise.all([
    db.booking.count({ where: { providerId: userId, status: "COMPLETED" } }),
    // A request is answered when the provider confirms or declines it; the
    // first such history row by the provider marks the answer. Expired and
    // customer-cancelled requests are not answers and are not counted.
    db.booking.findMany({
      where: {
        providerId: userId,
        createdAt: { gte: since },
        statusHistory: {
          some: {
            actorId: userId,
            fromStatus: "PENDING",
            toStatus: { in: ["CONFIRMED", "DECLINED"] },
          },
        },
      },
      select: {
        createdAt: true,
        statusHistory: {
          where: {
            actorId: userId,
            fromStatus: "PENDING",
            toStatus: { in: ["CONFIRMED", "DECLINED"] },
          },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      take: 200,
    }),
  ]);

  const samples = answered
    .map((booking) =>
      booking.statusHistory[0]
        ? (booking.statusHistory[0].createdAt.getTime() -
            booking.createdAt.getTime()) /
          60_000
        : null,
    )
    .filter((value): value is number => value !== null && value >= 0);

  return {
    completedShoots,
    responseMinutes: medianMinutes(samples),
  };
}

/** Cached per provider like the rest of their public reads (~90s). */
export async function getProfileStats(userId: string) {
  const cached = unstable_cache(
    () => loadProfileStats(userId),
    [CACHE_KEY_VERSION, "public-profile", "stats", userId],
    { tags: [profileUserTag(userId)], revalidate: CACHE_TTL.publicProfile },
  );
  return cached();
}
