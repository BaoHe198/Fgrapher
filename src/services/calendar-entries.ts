import { instantToVietnam, vietnamToInstant } from "@/lib/calendar/agenda";
import { PROVIDER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import type { CalendarEntryInput } from "@/lib/validations/calendar";

/**
 * The jobs a provider writes into their own calendar (CalendarEntry): work
 * taken outside Fgrapher, kept next to their Fgrapher bookings so the day is
 * in one place.
 *
 * Two rules everything here follows:
 *  - an entry belongs to one account and is read and written only by it.
 *    Every function takes the owner's id and filters on it; there is no
 *    "get entry by id" that does not.
 *  - an entry closes its hours to Fgrapher customers. Nothing is copied to
 *    make that true — the availability engine reads these rows itself
 *    (entryWindowsForProviders below) the same way it reads bookings, so an
 *    entry that is moved or deleted frees and takes time with no second
 *    write to keep in step.
 */
export class CalendarEntryError extends Error {
  constructor(
    public code: "not_provider" | "not_found",
    public status: 403 | 404,
  ) {
    super(code);
    this.name = "CalendarEntryError";
  }
}

async function assertProvider(userId: string) {
  const role = await db.userRole.findFirst({
    where: { userId, active: true, role: { in: PROVIDER_ROLES } },
    select: { id: true },
  });
  if (!role) throw new CalendarEntryError("not_provider", 403);
}

function toRow(input: CalendarEntryInput) {
  return {
    title: input.title,
    startAt: vietnamToInstant(input.date, input.startTime),
    endAt: vietnamToInstant(input.date, input.endTime),
    locationAddress: input.locationAddress ?? null,
    customerName: input.customerName ?? null,
    customerPhone: input.customerPhone ?? null,
    price: input.price ?? null,
    notes: input.notes ?? null,
  };
}

export async function createCalendarEntry(
  userId: string,
  input: CalendarEntryInput,
) {
  await assertProvider(userId);
  return db.calendarEntry.create({ data: { userId, ...toRow(input) } });
}

export async function updateCalendarEntry(
  id: string,
  userId: string,
  input: CalendarEntryInput,
) {
  await assertProvider(userId);
  const { count } = await db.calendarEntry.updateMany({
    where: { id, userId },
    data: toRow(input),
  });
  if (count === 0) throw new CalendarEntryError("not_found", 404);
  return db.calendarEntry.findFirstOrThrow({ where: { id, userId } });
}

/**
 * Gone for good, unlike most rows here: an entry holds a third party's name
 * and phone number, and "removed" has to mean removed (see the model's
 * comment in schema.prisma).
 */
export async function deleteCalendarEntry(id: string, userId: string) {
  const { count } = await db.calendarEntry.deleteMany({
    where: { id, userId },
  });
  if (count === 0) throw new CalendarEntryError("not_found", 404);
}

export function getCalendarEntry(id: string, userId: string) {
  return db.calendarEntry.findFirst({ where: { id, userId } });
}

/** One provider's entries touching [from, to) — real instants. */
export function listCalendarEntries(userId: string, from: Date, to: Date) {
  return db.calendarEntry.findMany({
    where: { userId, startAt: { lt: to }, endAt: { gt: from } },
    orderBy: { startAt: "asc" },
  });
}

/**
 * The hours these providers have closed with their own entries on the
 * Vietnam days from `fromKey` up to (not including) `toKey`, as local
 * "HH:mm" windows — the form both availability engines already use for a
 * booking. Carries nothing but the time: who the job is for is nobody
 * else's business, including the code that decides whether a slot is free.
 */
export async function entryWindowsForProviders(
  userIds: string[],
  fromKey: string,
  toKey: string,
) {
  if (userIds.length === 0) return [];
  const entries = await db.calendarEntry.findMany({
    where: {
      userId: { in: userIds },
      startAt: { lt: vietnamToInstant(toKey, "00:00") },
      endAt: { gt: vietnamToInstant(fromKey, "00:00") },
    },
    select: { userId: true, startAt: true, endAt: true },
  });
  return entries.map((entry) => {
    const start = instantToVietnam(entry.startAt);
    const end = instantToVietnam(entry.endAt);
    return {
      userId: entry.userId,
      dateKey: start.dateKey,
      startTime: start.time,
      // An entry is one calendar day by validation; should one ever end on
      // a later day, it closes the rest of the day it starts on.
      endTime: end.dateKey === start.dateKey ? end.time : "23:59",
    };
  });
}
