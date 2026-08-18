import { db } from "@/lib/db";

// This module treats every date as a UTC-anchored calendar date (matching
// Postgres `@db.Date` / Prisma's normalization of Booking.date and
// BlockedDate.date to UTC midnight) — never local-timezone Date methods
// (getDay/getDate/toISOString-after-local-math), which drift by a day for
// any server or visitor running ahead of UTC (this app's Vietnamese
// audience is UTC+7), silently mislabeling which weekday a slot belongs to.

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

const SLOT_MINUTES = 60;

export interface DayAvailability {
  date: string;
  busy: boolean;
  slots: { time: string; available: boolean }[];
}

export async function getProviderAvailability(
  providerId: string,
  from: Date,
  days: number,
): Promise<DayAvailability[]> {
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + days);

  const [weekly, blockedDates, bookings] = await Promise.all([
    db.availability.findMany({ where: { userId: providerId, isActive: true } }),
    db.blockedDate.findMany({
      where: { userId: providerId, date: { gte: from, lt: to } },
    }),
    db.booking.findMany({
      where: {
        providerId,
        status: { in: ["PENDING", "CONFIRMED"] },
        date: { gte: from, lt: to },
      },
      select: { date: true, startTime: true },
    }),
  ]);

  const blockedDateStrings = new Set(blockedDates.map((b) => toDateKey(b.date)));
  const bookedByDate = new Map<string, Set<string>>();
  for (const booking of bookings) {
    const key = toDateKey(booking.date);
    if (!bookedByDate.has(key)) bookedByDate.set(key, new Set());
    bookedByDate.get(key)!.add(booking.startTime);
  }

  const result: DayAvailability[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + i);
    const dateString = toDateKey(date);
    const dayOfWeek = date.getUTCDay();

    const isBlocked = blockedDateStrings.has(dateString);
    const windows = weekly.filter((w) => w.dayOfWeek === dayOfWeek);

    if (isBlocked || windows.length === 0) {
      result.push({ date: dateString, busy: true, slots: [] });
      continue;
    }

    const bookedTimes = bookedByDate.get(dateString) ?? new Set();
    const slots: { time: string; available: boolean }[] = [];

    for (const window of windows) {
      const start = timeToMinutes(window.startTime);
      const end = timeToMinutes(window.endTime);
      for (let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES) {
        const time = minutesToTime(m);
        slots.push({ time, available: !bookedTimes.has(time) });
      }
    }

    result.push({ date: dateString, busy: slots.every((s) => !s.available), slots });
  }

  return result;
}
