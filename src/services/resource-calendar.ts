import type { Prisma } from "@prisma/client";

import { PROVIDER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";

/**
 * The one place that knows a provider's calendar lives on a
 * BookableResource rather than on their user row.
 *
 * `Availability` and `BlockedDate` were keyed on userId, which made the
 * calendar belong to the person instead of to the thing being booked. Every
 * read and write now goes through here, so the rest of the app never has to
 * name a resource, and Phase 2 (rooms, staff) becomes extra resource rows
 * rather than a second migration.
 *
 * Callers keep working in Vietnam local time — "09:00" on a given day —
 * because that is what a provider sets and what the UI shows. Storage is
 * UTC. Vietnam is UTC+7 with no daylight saving, so the conversion is a
 * fixed offset; the same rule as
 * scripts/backfill-provider-architecture.ts.
 */
const VN_OFFSET_MS = 7 * 3_600_000;

export function localDayAndTimeToInstant(date: Date, time: string): Date {
  const [hh, mm] = time.split(":").map(Number);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hh,
      mm,
    ) - VN_OFFSET_MS,
  );
}

function instantToLocalParts(instant: Date) {
  const shifted = new Date(instant.getTime() + VN_OFFSET_MS);
  return {
    dateKey: shifted.toISOString().slice(0, 10),
    time: shifted.toISOString().slice(11, 16),
  };
}

/**
 * The resource whose calendar this provider's bookings occupy, created on
 * first use. Returns null for an account that takes no bookings — a
 * customer, an admin, or a shop — which is the caller's cue that there is no
 * calendar to read or write.
 */
export async function resourceIdForProvider(
  userId: string,
  tx: Prisma.TransactionClient = db,
) {
  const existing = await tx.bookableResource.findFirst({
    where: { profile: { userId }, type: "PROVIDER_SELF", isActive: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Created lazily as well as by the backfill, so a provider who activates a
  // role after the migration still gets one without a second script.
  const profile = await tx.profile.findFirst({
    where: { userId, role: { in: PROVIDER_ROLES } },
    select: { id: true },
  });
  if (!profile) return null;

  const created = await tx.bookableResource.create({
    data: { profileId: profile.id, type: "PROVIDER_SELF" },
    select: { id: true },
  });
  return created.id;
}

export interface WeeklyRule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export async function listWeeklyRules(userId: string): Promise<WeeklyRule[]> {
  const resourceId = await resourceIdForProvider(userId);
  if (!resourceId) return [];
  const rules = await db.availabilityRule.findMany({
    where: { resourceId, isActive: true },
    select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true },
    orderBy: { dayOfWeek: "asc" },
  });
  return rules;
}

/** Replaces the whole week in one transaction, which is how the editor saves. */
export async function replaceWeeklyRules(
  userId: string,
  rules: { dayOfWeek: number; startTime: string; endTime: string }[],
) {
  const resourceId = await resourceIdForProvider(userId);
  if (!resourceId) return 0;

  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { resourceId } }),
    db.availabilityRule.createMany({
      data: rules.map((rule) => ({ resourceId, ...rule })),
    }),
  ]);
  return rules.length;
}

export interface CalendarBlock {
  id: string;
  /** Local calendar day, "YYYY-MM-DD". */
  dateKey: string;
  /** null on both = the whole day is blocked. */
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

/** A block covering the whole local day, which the legacy shape spelled as nulls. */
function isWholeDay(startTime: string, endTime: string) {
  return startTime === "00:00" && (endTime === "23:59" || endTime === "00:00");
}

export async function listBlocks(
  userId: string,
  from: Date,
  to: Date,
): Promise<CalendarBlock[]> {
  const resourceId = await resourceIdForProvider(userId);
  if (!resourceId) return [];

  const blocks = await db.availabilityBlock.findMany({
    where: { resourceId, startAt: { gte: from, lt: to } },
    orderBy: { startAt: "asc" },
  });

  return blocks.map((block) => {
    const start = instantToLocalParts(block.startAt);
    const end = instantToLocalParts(block.endAt);
    const whole = isWholeDay(start.time, end.time);
    return {
      id: block.id,
      dateKey: start.dateKey,
      startTime: whole ? null : start.time,
      endTime: whole ? null : end.time,
      reason: block.reason,
    };
  });
}

/**
 * One block per local day, replacing whatever was there — the same contract
 * the old single-row-per-date upsert had.
 */
export async function upsertBlock(
  userId: string,
  input: {
    date: Date;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
  },
) {
  const resourceId = await resourceIdForProvider(userId);
  if (!resourceId) return null;

  const startAt = localDayAndTimeToInstant(
    input.date,
    input.startTime ?? "00:00",
  );
  const endAt = localDayAndTimeToInstant(input.date, input.endTime ?? "23:59");

  const dayStart = localDayAndTimeToInstant(input.date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);

  return db.$transaction(async (tx) => {
    await tx.availabilityBlock.deleteMany({
      where: { resourceId, startAt: { gte: dayStart, lt: dayEnd } },
    });
    return tx.availabilityBlock.create({
      data: { resourceId, startAt, endAt, reason: input.reason ?? null },
    });
  });
}

/** Deletes a block, but only if it belongs to this provider. */
export async function deleteBlock(id: string, userId: string) {
  const resourceId = await resourceIdForProvider(userId);
  if (!resourceId) return false;
  const { count } = await db.availabilityBlock.deleteMany({
    where: { id, resourceId },
  });
  return count > 0;
}

/**
 * Bulk variants for the two callers that ask about many providers at once —
 * Fmap's "who is free at this hour" and the request-offer matcher. Both used
 * to query the userId-keyed tables directly; going through the resource join
 * keeps that single meaning of "a provider's calendar" in one file.
 */
export async function weeklyWindowsForProviders(
  userIds: string[],
  dayOfWeek: number,
) {
  const rules = await db.availabilityRule.findMany({
    where: {
      dayOfWeek,
      isActive: true,
      resource: { profile: { userId: { in: userIds } } },
    },
    select: {
      startTime: true,
      endTime: true,
      resource: { select: { profile: { select: { userId: true } } } },
    },
  });
  return rules.map((rule) => ({
    userId: rule.resource.profile.userId,
    startTime: rule.startTime,
    endTime: rule.endTime,
  }));
}

export async function blocksForProviders(userIds: string[], localDate: Date) {
  const dayStart = localDayAndTimeToInstant(localDate, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);

  const blocks = await db.availabilityBlock.findMany({
    where: {
      startAt: { gte: dayStart, lt: dayEnd },
      resource: { profile: { userId: { in: userIds } } },
    },
    select: {
      startAt: true,
      endAt: true,
      resource: { select: { profile: { select: { userId: true } } } },
    },
  });

  return blocks.map((block) => {
    const start = instantToLocalParts(block.startAt);
    const end = instantToLocalParts(block.endAt);
    const whole = isWholeDay(start.time, end.time);
    return {
      userId: block.resource.profile.userId,
      startTime: whole ? null : start.time,
      endTime: whole ? null : end.time,
    };
  });
}

/** Providers whose whole day is blocked — what the offer matcher screens on. */
export async function wholeDayBlockedProviders(
  userIds: string[],
  localDate: Date,
) {
  const blocks = await blocksForProviders(userIds, localDate);
  return new Set(
    blocks
      .filter((block) => block.startTime === null && block.endTime === null)
      .map((block) => block.userId),
  );
}
