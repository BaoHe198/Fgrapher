import { timeToMinutes } from "@/lib/sun";

// Pure date arithmetic for bookings, kept apart from services/bookings.ts
// (which needs the database and the environment) so it can be unit-tested.

/** A Vietnam wall-clock date + "HH:mm" as a real instant (UTC+7, no DST). */
export function vietnamInstant(date: string, time: string) {
  return Date.parse(`${date}T${time}:00.000Z`) - 7 * 3_600_000;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Where a booking lands when a reschedule proposal is accepted. Pure, so
 * the arithmetic is unit-tested without a database.
 */
export function movedWindow({
  date,
  startTime,
  endTime,
  previousStart,
  previousEnd,
  fallbackMinutes,
}: {
  date: string;
  startTime: string;
  endTime: string | null;
  previousStart: string;
  previousEnd: string | null;
  fallbackMinutes: number;
}) {
  const start = timeToMinutes(startTime);
  const previous = previousEnd
    ? timeToMinutes(previousEnd) - timeToMinutes(previousStart)
    : 0;
  const minutes =
    endTime && timeToMinutes(endTime) > start
      ? timeToMinutes(endTime) - start
      : previous > 0
        ? previous
        : fallbackMinutes;
  // "HH:mm" cannot say "tomorrow": a session that would run past midnight
  // is shown ending at 23:59, while the hold keeps its true length.
  const endOfDay = 24 * 60 - 1;
  const shownEnd = Math.min(start + minutes, endOfDay);
  const startAt = new Date(vietnamInstant(date, startTime));
  return {
    endTime: `${pad2(Math.floor(shownEnd / 60))}:${pad2(shownEnd % 60)}`,
    startAt,
    endAt: new Date(startAt.getTime() + minutes * 60_000),
  };
}

// A reschedule that was agreed, written into BookingStatusHistory.note on a
// row whose status does not change (fromStatus === toStatus). The table
// records what happened to a booking, and "moved from 09:00 on the 5th to
// 08:00 on the 6th" is part of that; without it the timeline showed a
// confirmed booking at a time nobody had asked for, with no trace of why.
const RESCHEDULE_NOTE =
  /^RESCHEDULED (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) -> (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/;

interface Slot {
  /** yyyy-MM-dd, Vietnam calendar date. */
  date: string;
  /** HH:mm. */
  startTime: string;
}

export function rescheduleNote(from: Slot, to: Slot) {
  return `RESCHEDULED ${from.date} ${from.startTime} -> ${to.date} ${to.startTime}`;
}

/** The two slots of a reschedule row, or null for any other note. */
export function parseRescheduleNote(
  note: string | null | undefined,
): { from: Slot; to: Slot } | null {
  const match = note?.match(RESCHEDULE_NOTE);
  if (!match) return null;
  return {
    from: { date: match[1], startTime: match[2] },
    to: { date: match[3], startTime: match[4] },
  };
}
