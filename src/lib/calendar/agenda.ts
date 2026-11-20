import type { BookingStatus } from "@prisma/client";

/**
 * The work calendar's one shape for "something on a day": a Fgrapher
 * booking, a job the provider wrote in themselves, or a busy block. The
 * server builds these (services/work-calendar.ts); the calendar page, the
 * daily digest and the phone-calendar feed all read them, so the three can
 * never disagree about what is on a given day or when it starts.
 *
 * Days and times are Vietnam local — what the provider typed and what they
 * read. Vietnam is UTC+7 all year, so the conversion is a fixed offset.
 */
export type AgendaKind = "BOOKING" | "ENTRY" | "BLOCK";

export interface AgendaItem {
  /** Unique within its kind; `key` below is unique across kinds. */
  id: string;
  kind: AgendaKind;
  /** "yyyy-MM-dd", the Vietnam calendar day it falls on. */
  dateKey: string;
  /** "HH:mm" Vietnam time. Both null means the whole day (blocks only). */
  startTime: string | null;
  endTime: string | null;
  /** Service or job name. Empty for a block — the screen names those. */
  title: string;
  /** Bookings only. */
  status: BookingStatus | null;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  /** What the customer wrote (booking), the job notes (entry), or the
   *  reason (block). */
  notes: string | null;
  /** The provider's own note on a booking. Entries keep theirs in `notes`. */
  privateNote: string | null;
  /** VND. */
  price: number | null;
  /** Bookings open their own page; entries and blocks are edited in place. */
  href: string | null;
}

export const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export function agendaKey(item: Pick<AgendaItem, "kind" | "id">) {
  return `${item.kind}:${item.id}`;
}

/** An instant as the Vietnam day and time it falls on. */
export function instantToVietnam(instant: Date) {
  const shifted = new Date(instant.getTime() + VIETNAM_OFFSET_MS).toISOString();
  return { dateKey: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** A Vietnam day and "HH:mm" as the instant it names. */
export function vietnamToInstant(dateKey: string, time: string) {
  return new Date(
    new Date(`${dateKey}T${time}:00.000Z`).getTime() - VIETNAM_OFFSET_MS,
  );
}

/** Today in Vietnam, as a date key. */
export function vietnamTodayKey(now = new Date()) {
  return instantToVietnam(now).dateKey;
}

export function isDateKey(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, as AvailabilityRule.dayOfWeek counts. */
export function weekdayOf(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

/** The Monday-to-Sunday week containing this day. */
export function weekOf(dateKey: string) {
  const mondayOffset = (weekdayOf(dateKey) + 6) % 7;
  const monday = addDays(dateKey, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/**
 * What the calendar loads for a month: the month itself widened to whole
 * weeks, so the week strip has its seven days even where a week straddles
 * two months. `to` is exclusive.
 */
export function monthWindow(dateKey: string) {
  const first = `${dateKey.slice(0, 7)}-01`;
  const nextMonth = new Date(`${first}T00:00:00.000Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const last = addDays(nextMonth.toISOString().slice(0, 10), -1);
  return { from: weekOf(first)[0], to: addDays(weekOf(last)[6], 1) };
}

/** Earliest first; a whole-day item leads its day. */
export function sortAgenda<T extends AgendaItem>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
    const aStart = a.startTime ?? "";
    const bStart = b.startTime ?? "";
    if (aStart !== bStart) return aStart < bStart ? -1 : 1;
    return agendaKey(a) < agendaKey(b) ? -1 : 1;
  });
}

export function groupByDay<T extends AgendaItem>(items: T[]) {
  const days = new Map<string, T[]>();
  for (const item of sortAgenda(items)) {
    const list = days.get(item.dateKey);
    if (list) list.push(item);
    else days.set(item.dateKey, [item]);
  }
  return days;
}

function minutes(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Keys of the jobs on one day that share time with another job. Blocks are
 * not jobs and never clash; a booking still waiting for an answer does, so
 * the provider sees the clash before confirming it.
 */
export function clashingKeys(dayItems: AgendaItem[]) {
  const jobs = dayItems.filter(
    (item) => item.kind !== "BLOCK" && item.startTime && item.endTime,
  );
  const clashing = new Set<string>();
  for (let i = 0; i < jobs.length; i++) {
    for (let j = i + 1; j < jobs.length; j++) {
      const a = jobs[i];
      const b = jobs[j];
      if (
        minutes(a.startTime!) < minutes(b.endTime!) &&
        minutes(b.startTime!) < minutes(a.endTime!)
      ) {
        clashing.add(agendaKey(a));
        clashing.add(agendaKey(b));
      }
    }
  }
  return clashing;
}

/** "09:00–11:00", "09:00", or null for a whole-day item. */
export function timeRangeLabel(
  item: Pick<AgendaItem, "startTime" | "endTime">,
) {
  if (!item.startTime) return null;
  return item.endTime ? `${item.startTime}–${item.endTime}` : item.startTime;
}

/** Opens the address in whichever maps app the phone prefers. */
export function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** A `tel:` link, or null when the text holds nothing a phone can dial. */
export function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 8 ? `tel:${digits}` : null;
}
