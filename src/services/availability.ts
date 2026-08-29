import { MIN_NOTICE_HOURS } from "@/lib/constants";
import { db } from "@/lib/db";

// This module treats every date as a UTC-anchored calendar date (matching
// Postgres `@db.Date` / Prisma's normalization of Booking.date and
// BlockedDate.date to UTC midnight) — never local-timezone Date methods
// (getDay/getDate/toISOString-after-local-math), which drift by a day for
// any server or visitor running ahead of UTC (this app's Vietnamese
// audience is UTC+7), silently mislabeling which weekday a slot belongs to.
//
// Slot instants (for the past-slot and minimum-notice checks) are computed
// by treating the stored "HH:MM" time string as a UTC wall-clock time, the
// same simplification already used everywhere else in the app (booking
// times are displayed as-is, with no timezone conversion) — there's no
// per-provider timezone field, so "now" is compared in the same frame.

export function timeToMinutes(time: string) {
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
  serviceDurationMinutes = SLOT_MINUTES,
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
      select: {
        date: true,
        startTime: true,
        service: { select: { duration: true } },
      },
    }),
  ]);

  // null start/end = the whole day is blocked; otherwise only that window
  // is (see the BlockedDate schema comment — one row per date).
  const blockedByDate = new Map(
    blockedDates.map((b) => [
      toDateKey(b.date),
      { startTime: b.startTime, endTime: b.endTime },
    ]),
  );

  // Existing bookings occupy [startMinutes, startMinutes + duration), not
  // just their exact start slot — a 2-hour booking at 10:00 must also block
  // the 11:00 slot, or a second client could book an overlapping session.
  const occupiedByDate = new Map<string, { start: number; end: number }[]>();
  for (const booking of bookings) {
    const key = toDateKey(booking.date);
    const start = timeToMinutes(booking.startTime);
    const duration = booking.service?.duration ?? SLOT_MINUTES;
    if (!occupiedByDate.has(key)) occupiedByDate.set(key, []);
    occupiedByDate.get(key)!.push({ start, end: start + duration });
  }

  const now = Date.now();
  const minNoticeInstant = now + MIN_NOTICE_HOURS * 60 * 60 * 1000;

  const result: DayAvailability[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + i);
    const dateString = toDateKey(date);
    const dayOfWeek = date.getUTCDay();

    const block = blockedByDate.get(dateString);
    const isWholeDayBlocked = block != null && block.startTime == null;
    const windows = weekly.filter((w) => w.dayOfWeek === dayOfWeek);

    if (isWholeDayBlocked || windows.length === 0) {
      result.push({ date: dateString, busy: true, slots: [] });
      continue;
    }

    const blockedRange =
      block?.startTime != null && block.endTime != null
        ? {
            start: timeToMinutes(block.startTime),
            end: timeToMinutes(block.endTime),
          }
        : null;

    const occupied = occupiedByDate.get(dateString) ?? [];
    const slots: { time: string; available: boolean }[] = [];

    for (const window of windows) {
      const start = timeToMinutes(window.startTime);
      const end = timeToMinutes(window.endTime);
      for (
        let m = start;
        m + serviceDurationMinutes <= end;
        m += SLOT_MINUTES
      ) {
        const slotEnd = m + serviceDurationMinutes;
        const overlapsBooking = occupied.some(
          (o) => m < o.end && slotEnd > o.start,
        );
        const overlapsBlock =
          blockedRange != null &&
          m < blockedRange.end &&
          slotEnd > blockedRange.start;
        const slotInstant = Date.parse(
          `${dateString}T${minutesToTime(m)}:00.000Z`,
        );
        const tooSoon = slotInstant < minNoticeInstant;
        slots.push({
          time: minutesToTime(m),
          available: !overlapsBooking && !overlapsBlock && !tooSoon,
        });
      }
    }

    result.push({
      date: dateString,
      busy: slots.every((s) => !s.available),
      slots,
    });
  }

  return result;
}

// Prompt F3, VIỆC 2 — "KHÔNG cho chặn ngày đã có booking ở trạng thái
// CONFIRMED". A whole-day block (startTime/endTime both undefined)
// conflicts with any CONFIRMED booking that day; a time-range block only
// conflicts with a CONFIRMED booking whose own [start, start+duration)
// overlaps the requested range.
export async function findConfirmedBookingConflicts(
  providerId: string,
  date: Date,
  startTime?: string,
  endTime?: string,
) {
  const bookings = await db.booking.findMany({
    where: { providerId, status: "CONFIRMED", date },
    select: {
      id: true,
      startTime: true,
      service: { select: { duration: true } },
    },
  });

  if (startTime == null || endTime == null) return bookings;

  const blockStart = timeToMinutes(startTime);
  const blockEnd = timeToMinutes(endTime);
  return bookings.filter((b) => {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = bStart + (b.service?.duration ?? SLOT_MINUTES);
    return blockStart < bEnd && blockEnd > bStart;
  });
}

export async function listBlockedDates(userId: string, from: Date, to: Date) {
  return db.blockedDate.findMany({
    where: { userId, date: { gte: from, lt: to } },
    orderBy: { date: "asc" },
  });
}

// Prompt F3, VIỆC 4 — the server-side gate createBooking() calls before
// accepting a request, so a direct API call can't bypass what the booking
// widget merely disables in the UI. Reuses the same day-availability
// computation the widget itself reads (getProviderAvailability), scoped to
// the single requested date, so both surfaces can never disagree.
export async function isSlotBookable(
  providerId: string,
  dateString: string,
  startTime: string,
  durationMinutes: number,
) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const [day] = await getProviderAvailability(
    providerId,
    date,
    1,
    durationMinutes,
  );
  return day?.slots.some((s) => s.time === startTime && s.available) ?? false;
}
