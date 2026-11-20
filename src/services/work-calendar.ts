import { randomBytes } from "node:crypto";

import { getTranslations } from "next-intl/server";

import {
  addDays,
  type AgendaItem,
  digestDateKey,
  instantToVietnam,
  sortAgenda,
  timeRangeLabel,
  vietnamToInstant,
  vietnamTodayKey,
} from "@/lib/calendar/agenda";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ics";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db-lock";
import { scheduleDigestEmailHtml } from "@/lib/email";
import { formatVND, formatWeekdayDayMonth } from "@/lib/format";
import { listBookingsForRange } from "@/services/bookings";
import { listCalendarEntries } from "@/services/calendar-entries";
import { notify } from "@/services/notification";
import { listBlocks } from "@/services/resource-calendar";

/**
 * A provider's working day as one list: Fgrapher bookings, the jobs they
 * wrote in themselves, and the hours they marked busy. The calendar page,
 * the daily digest and the phone-calendar feed are three readings of this
 * one function, so none of them can show a day the others would not.
 *
 * `fromKey` / `toKey` are Vietnam days ("yyyy-MM-dd"), `toKey` exclusive.
 */
export async function getWorkAgenda(
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<AgendaItem[]> {
  const fromDay = new Date(`${fromKey}T00:00:00.000Z`);
  const toDay = new Date(`${toKey}T00:00:00.000Z`);

  const [bookings, entries, blocks] = await Promise.all([
    // Already redacted for the provider: a booking still waiting for their
    // answer comes without the customer's phone and address.
    listBookingsForRange({ providerId: userId, from: fromDay, to: toDay }),
    listCalendarEntries(
      userId,
      vietnamToInstant(fromKey, "00:00"),
      vietnamToInstant(toKey, "00:00"),
    ),
    listBlocks(userId, fromDay, toDay),
  ]);

  const notes = bookings.length
    ? await db.bookingNote.findMany({
        where: { userId, bookingId: { in: bookings.map((b) => b.id) } },
        select: { bookingId: true, note: true },
      })
    : [];
  const noteByBooking = new Map(notes.map((n) => [n.bookingId, n.note]));

  const items: AgendaItem[] = [
    ...bookings.map((booking): AgendaItem => ({
      id: booking.id,
      kind: "BOOKING",
      dateKey: booking.date.toISOString().slice(0, 10),
      startTime: booking.startTime,
      endTime: booking.endTime,
      title: booking.service?.name ?? "",
      status: booking.status,
      customerName: booking.customer.name ?? booking.customer.firstName,
      customerPhone: booking.contactPhone,
      address: booking.locationAddress,
      notes: booking.notes,
      privateNote: noteByBooking.get(booking.id) ?? null,
      price: booking.totalPrice,
      href: `/dashboard/bookings/${booking.id}`,
      updatedAt: booking.updatedAt.toISOString(),
    })),
    ...entries.map((entry): AgendaItem => {
      const start = instantToVietnam(entry.startAt);
      const end = instantToVietnam(entry.endAt);
      return {
        id: entry.id,
        kind: "ENTRY",
        dateKey: start.dateKey,
        startTime: start.time,
        endTime: end.dateKey === start.dateKey ? end.time : "23:59",
        title: entry.title,
        status: null,
        customerName: entry.customerName,
        customerPhone: entry.customerPhone,
        address: entry.locationAddress,
        notes: entry.notes,
        privateNote: null,
        price: entry.price,
        href: null,
        updatedAt: entry.updatedAt.toISOString(),
      };
    }),
    ...blocks.map((block): AgendaItem => ({
      id: block.id,
      kind: "BLOCK",
      dateKey: block.dateKey,
      startTime: block.startTime,
      endTime: block.endTime,
      title: "",
      status: null,
      customerName: null,
      customerPhone: null,
      address: null,
      notes: block.reason,
      privateNote: null,
      price: null,
      href: null,
      updatedAt: null,
    })),
  ];

  return sortAgenda(items);
}

// ---------------------------------------------------------------------------
// Private notes on a booking
// ---------------------------------------------------------------------------

export class BookingNoteError extends Error {}

/** The caller's own note on a booking they are part of, or "" if none. */
export async function getBookingNote(bookingId: string, userId: string) {
  const booking = await db.booking.findFirst({
    where: {
      id: bookingId,
      OR: [{ providerId: userId }, { customerId: userId }],
    },
    select: { id: true },
  });
  if (!booking) throw new BookingNoteError("not_found");
  const row = await db.bookingNote.findUnique({
    where: { bookingId_userId: { bookingId, userId } },
    select: { note: true },
  });
  return row?.note ?? "";
}

/**
 * Saves the caller's own note on a booking they are part of; an empty note
 * removes it. The other side never sees it — see BookingNote in
 * schema.prisma for why it is not a column on Booking.
 */
export async function saveBookingNote(
  bookingId: string,
  userId: string,
  note: string,
) {
  const booking = await db.booking.findFirst({
    where: {
      id: bookingId,
      OR: [{ providerId: userId }, { customerId: userId }],
    },
    select: { id: true },
  });
  if (!booking) throw new BookingNoteError("not_found");

  const text = note.trim();
  if (!text) {
    await db.bookingNote.deleteMany({ where: { bookingId, userId } });
    return null;
  }
  const where = { bookingId_userId: { bookingId, userId } };
  try {
    await db.bookingNote.upsert({
      where,
      create: { bookingId, userId, note: text },
      update: { note: text },
    });
  } catch (error) {
    // Two saves at once: the other one created the row first.
    if (!isUniqueViolation(error)) throw error;
    await db.bookingNote.update({ where, data: { note: text } });
  }
  return text;
}

// ---------------------------------------------------------------------------
// Daily digest
// ---------------------------------------------------------------------------

export type DigestKind = "evening" | "morning";

const DELIVERY_CONCURRENCY = 10;

/**
 * "Tomorrow you have…" in the evening and "Today you have…" in the morning,
 * to every provider with confirmed work on that day — Fgrapher bookings and
 * their own entries alike, in the order the day will run.
 *
 * Runs from a cron that fires once a day per kind (Vercel Hobby cannot do
 * better; see docs/ops), so this is the reminder that works for everyone.
 * The exact-time alarm is the phone's job, through the calendar feed below.
 *
 * Deterministic notification ids and email keys make a retry of the same
 * day's run harmless.
 */
export async function sendScheduleDigests(kind: DigestKind, now = new Date()) {
  const dateKey = digestDateKey(kind, now);
  const nextKey = addDays(dateKey, 1);

  const [bookings, entries] = await Promise.all([
    db.booking.findMany({
      where: {
        status: "CONFIRMED",
        date: new Date(`${dateKey}T00:00:00.000Z`),
        provider: { deletedAt: null, isSuspended: false },
      },
      select: {
        providerId: true,
        startTime: true,
        endTime: true,
        locationAddress: true,
        service: { select: { name: true } },
        customer: { select: { name: true, firstName: true } },
      },
    }),
    db.calendarEntry.findMany({
      where: {
        startAt: {
          gte: vietnamToInstant(dateKey, "00:00"),
          lt: vietnamToInstant(nextKey, "00:00"),
        },
        user: { deletedAt: null, isSuspended: false },
      },
      select: {
        userId: true,
        title: true,
        startAt: true,
        endAt: true,
        locationAddress: true,
        customerName: true,
      },
    }),
  ]);

  const [emailT, notificationT] = await Promise.all([
    getTranslations({ locale: "vi", namespace: "libServices.email" }),
    getTranslations({ locale: "vi", namespace: "libServices.notifications" }),
  ]);

  interface Line {
    startTime: string;
    time: string;
    title: string;
    who: string | null;
    where: string | null;
  }
  const byUser = new Map<string, Line[]>();
  const add = (userId: string, line: Line) => {
    const lines = byUser.get(userId);
    if (lines) lines.push(line);
    else byUser.set(userId, [line]);
  };
  for (const booking of bookings) {
    add(booking.providerId, {
      startTime: booking.startTime,
      time: timeRangeLabel(booking) ?? booking.startTime,
      title: booking.service?.name ?? notificationT("scheduleDigest.customJob"),
      who: booking.customer.name ?? booking.customer.firstName,
      where: booking.locationAddress,
    });
  }
  for (const entry of entries) {
    const start = instantToVietnam(entry.startAt).time;
    const end = instantToVietnam(entry.endAt).time;
    add(entry.userId, {
      startTime: start,
      time: `${start}–${end}`,
      title: entry.title,
      who: entry.customerName,
      where: entry.locationAddress,
    });
  }

  const dayLabel = formatWeekdayDayMonth(`${dateKey}T00:00:00.000Z`);
  const calendarPath = `/dashboard/calendar?date=${dateKey}`;
  const recipients = [...byUser.entries()];

  for (let i = 0; i < recipients.length; i += DELIVERY_CONCURRENCY) {
    await Promise.all(
      recipients.slice(i, i + DELIVERY_CONCURRENCY).map(([userId, lines]) => {
        lines.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
        const summary = lines
          .slice(0, 3)
          .map((line) => `${line.time} ${line.title}`)
          .join("; ");
        return notify({
          notificationId: `schedule-digest:${kind}:${dateKey}:${userId}`,
          userId,
          type: "BOOKING_REMINDER",
          title: notificationT(`scheduleDigest.${kind}Title`, {
            count: lines.length,
          }),
          message:
            lines.length > 3
              ? notificationT("scheduleDigest.messageMore", {
                  summary,
                  more: lines.length - 3,
                })
              : summary,
          data: { href: calendarPath, dateKey },
          email: {
            subject: emailT(`scheduleDigest.${kind}Subject`, {
              count: lines.length,
              day: dayLabel,
            }),
            html: scheduleDigestEmailHtml({
              t: emailT,
              kind,
              dayLabel,
              lines,
              calendarUrl: appUrl(calendarPath),
            }),
            dedupe: ["schedule-digest", kind, dateKey],
          },
        });
      }),
    );
  }

  return recipients.length;
}

// ---------------------------------------------------------------------------
// Phone calendar: one event, or the whole schedule as a subscription
// ---------------------------------------------------------------------------

const FEED_DAYS_BACK = 30;
const FEED_DAYS_AHEAD = 365;
/** One alert an hour ahead; the evening digest covers "tomorrow". */
const ALARM_MINUTES = [60];

async function toIcsEvents(items: AgendaItem[]): Promise<IcsEvent[]> {
  const t = await getTranslations({
    locale: "vi",
    namespace: "libServices.calendarFeed",
  });
  return items
    .filter((item) => item.kind !== "BLOCK" && item.startTime)
    .map((item) => {
      const start = vietnamToInstant(item.dateKey, item.startTime!);
      const end = item.endTime
        ? vietnamToInstant(item.dateKey, item.endTime)
        : new Date(start.getTime() + 60 * 60 * 1000);
      const pending = item.status === "PENDING";
      const title = item.title || t("customJob");
      const description = [
        item.customerName ? t("customer", { name: item.customerName }) : null,
        item.customerPhone ? t("phone", { phone: item.customerPhone }) : null,
        item.price ? t("price", { price: formatVND(item.price) }) : null,
        item.notes ? t("notes", { notes: item.notes }) : null,
        item.privateNote ? t("privateNote", { note: item.privateNote }) : null,
        item.href ? appUrl(item.href) : null,
      ]
        .filter(Boolean)
        .join("\n");
      return {
        uid: `${item.kind.toLowerCase()}-${item.id}@fgrapher`,
        start,
        end,
        summary: [
          pending ? t("pendingPrefix") : null,
          title,
          item.customerName ? `· ${item.customerName}` : null,
        ]
          .filter(Boolean)
          .join(" "),
        location: item.address,
        description: description || null,
        url: item.href ? appUrl(item.href) : null,
        status: pending ? "TENTATIVE" : "CONFIRMED",
        // Lets a calendar app that kept an earlier copy (an imported .ics)
        // see this one is newer and replace it rather than ignore it.
        lastModified: item.updatedAt ? new Date(item.updatedAt) : null,
        alarmMinutes: ALARM_MINUTES,
      } satisfies IcsEvent;
    });
}

async function calendarName() {
  const t = await getTranslations({
    locale: "vi",
    namespace: "libServices.calendarFeed",
  });
  return t("name");
}

/** One job as a .ics file, for "add to my phone's calendar". */
export async function icsForAgendaItem(
  userId: string,
  kind: "BOOKING" | "ENTRY",
  id: string,
  dateKey: string,
) {
  // Read through the same agenda, scoped to the owner and the day, rather
  // than by id: that is what keeps this from ever serving someone else's.
  const items = await getWorkAgenda(userId, dateKey, addDays(dateKey, 1));
  const item = items.find((i) => i.kind === kind && i.id === id);
  if (!item) return null;
  return {
    item,
    ics: buildIcs(await toIcsEvents([item]), {
      calendarName: await calendarName(),
    }),
  };
}

/**
 * The whole schedule for whoever holds this token — a calendar app polling
 * with no session. Null for an unknown token, and for an account that has
 * been closed or suspended: its address stops working with it.
 */
export async function calendarFeedIcs(token: string, now = new Date()) {
  if (token.length < 20) return null;
  const user = await db.user.findFirst({
    where: { calendarFeedToken: token, deletedAt: null, isSuspended: false },
    select: { id: true },
  });
  if (!user) return null;

  const today = vietnamTodayKey(now);
  const items = await getWorkAgenda(
    user.id,
    addDays(today, -FEED_DAYS_BACK),
    addDays(today, FEED_DAYS_AHEAD),
  );
  return buildIcs(await toIcsEvents(items), {
    calendarName: await calendarName(),
    now,
  });
}

export async function getCalendarFeedToken(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { calendarFeedToken: true },
  });
  return user?.calendarFeedToken ?? null;
}

/**
 * Switches the subscription on, or replaces its address. Replacing is how
 * an address that got out is revoked: the old one stops answering at once.
 */
export async function issueCalendarFeedToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.user.update({
    where: { id: userId },
    data: { calendarFeedToken: token },
  });
  return token;
}

export async function revokeCalendarFeedToken(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { calendarFeedToken: null },
  });
}

export function calendarFeedUrl(token: string) {
  return appUrl(`/api/calendar/feed/${token}`);
}
