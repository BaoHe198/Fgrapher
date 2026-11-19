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
