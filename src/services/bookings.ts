import type { BookingStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { MIN_NOTICE_HOURS } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  bookingCancelledEmailHtml,
  bookingConfirmedEmailHtml,
  bookingDeclinedEmailHtml,
  bookingReminderEmailHtml,
  bookingRequestEmailHtml,
} from "@/lib/email";
import { getOrCreateConversation, sendMessage } from "@/services/messaging";
import { notify } from "@/services/notification";
import type { CreateBookingInput } from "@/lib/validations/booking";

// Translation helper for the shared email templates in @/lib/email —
// namespace "libServices.email". Request-triggered functions (called from a
// Route Handler, which always has the locale cookie next-intl reads — see
// src/i18n/request.ts) use getTranslations() with no override. Two call
// sites here have no request context of their own — sendBookingReminders
// (daily cron) and transitionBooking's actorId===null branch (the
// system/cron actor that expires bookings) — those pass
// { locale: "vi" } explicitly, matching this platform's Vietnamese-first
// default (CLAUDE.md rule 10).
//
// TODO(i18n): this file's own notify() title/message string literals
// (BOOKING_REQUEST, BOOKING_CONFIRMED, etc.) are still hardcoded English —
// out of scope for this pass, which only had to satisfy lib/email.ts's now-
// required `t` param. A future pass should add a "libServices.bookings"
// namespace and thread it through those call sites the same way.
function getEmailT(locale?: "vi") {
  return locale
    ? getTranslations({ locale, namespace: "libServices.email" })
    : getTranslations("libServices.email");
}

const PAGE_SIZE = 20;
// Prompt B7, VIỆC 2 — a PENDING request the provider never responds to
// auto-expires 48h after it was made (see BOOKING_EXPIRY_HOURS's use in
// createBooking and the hourly /api/cron/expire-bookings cron).
const BOOKING_EXPIRY_HOURS = 48;
// Prompt B7, VIỆC 4 — anti-spam: caps how many requests one customer can
// have simultaneously awaiting a response, checked in createBooking.
const MAX_PENDING_BOOKINGS_PER_USER = 5;

export type BookingTab =
  "ALL" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

const BOOKING_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
      firstName: true,
      avatar: true,
      email: true,
    },
  },
  provider: {
    select: {
      id: true,
      name: true,
      firstName: true,
      avatar: true,
      email: true,
    },
  },
  service: { select: { name: true, duration: true } },
} as const;

function partyName(party: { firstName: string | null; name: string | null }) {
  return party.firstName ?? party.name ?? "there";
}

// Anti-spam/safety (Prompt B7, VIỆC 4) — same rule getBookingDetail applies:
// a provider only sees the customer's contactPhone/locationAddress once
// they've accepted the request. BOOKING_INCLUDE has no top-level `select`
// on Booking, so it returns those two columns unfiltered regardless of
// status — every list-shaped read (listBookings, listBookingsForRange)
// must run its rows through this before returning, the same way
// getBookingDetail already does for the single-booking read, or a provider
// can see a PENDING booking's contact info through the list/calendar view
// even though the detail page for that exact booking would redact it.
function redactContactInfo<
  T extends {
    providerId: string;
    status: BookingStatus;
    contactPhone: string | null;
    locationAddress: string | null;
  },
>(booking: T, viewerId: string): T {
  const viewerIsProvider = booking.providerId === viewerId;
  const contactInfoVisible = !viewerIsProvider || booking.status !== "PENDING";
  if (contactInfoVisible) return booking;
  return { ...booking, contactPhone: null, locationAddress: null };
}

function dateLabel(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  });
}

function bookingUrlFor(bookingId: string) {
  return `${process.env.NEXTAUTH_URL ?? ""}/dashboard/bookings/${bookingId}`;
}

export async function listBookings({
  userId,
  isProvider,
  tab,
  page,
}: {
  userId: string;
  isProvider: boolean;
  tab: BookingTab;
  page: number;
}) {
  const where = isProvider ? { providerId: userId } : { customerId: userId };
  const statusFilter =
    tab === "CANCELLED"
      ? {
          status: {
            in: ["CANCELLED", "DECLINED", "EXPIRED"] as BookingStatus[],
          },
        }
      : tab !== "ALL"
        ? { status: tab }
        : {};

  const [bookings, total] = await Promise.all([
    db.booking.findMany({
      where: { ...where, ...statusFilter },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: BOOKING_INCLUDE,
    }),
    db.booking.count({ where: { ...where, ...statusFilter } }),
  ]);

  return {
    bookings: bookings.map((b) => redactContactInfo(b, userId)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function listBookingsForRange({
  providerId,
  from,
  to,
}: {
  providerId: string;
  from: Date;
  to: Date;
}) {
  const bookings = await db.booking.findMany({
    where: {
      providerId,
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
      date: { gte: from, lt: to },
    },
    orderBy: { date: "asc" },
    include: BOOKING_INCLUDE,
  });
  // Only ever called with the viewing provider's own id (see the calendar
  // route), so that's the viewer for redaction purposes too.
  return bookings.map((b) => redactContactInfo(b, providerId));
}

const VERIFIED_ROLE_SELECT = {
  where: { verificationStatus: "VERIFIED" as const },
  select: { role: true },
  take: 1,
};

export async function getBookingDetail(bookingId: string, userId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          firstName: true,
          avatar: true,
          username: true,
          // Crew-hire (Prompt B7, VIỆC 1): the "customer" on a child
          // booking is itself a provider (e.g. a Photographer hiring a
          // Model) — show their verified badge too, not just the
          // provider's.
          roles: VERIFIED_ROLE_SELECT,
        },
      },
      provider: {
        select: {
          id: true,
          name: true,
          firstName: true,
          avatar: true,
          username: true,
          // Verified badge (Prompt B3, VIỆC 4) — a booking isn't tied to a
          // specific provider role (serviceId is optional), so this shows
          // "verified" if the provider holds ANY verified provider role,
          // rather than trying to resolve which one this booking is for.
          roles: VERIFIED_ROLE_SELECT,
        },
      },
      service: { select: { name: true, description: true, duration: true } },
      review: { select: { id: true } },
      // Crew-hire (Prompt B7, VIỆC 1) — shown on the detail page so
      // either side can see the relationship. parentBooking's own
      // customer (the end client) is deliberately not exposed here to
      // the child booking's provider — only what job it's for.
      parentBooking: {
        select: {
          id: true,
          status: true,
          date: true,
          service: { select: { name: true } },
        },
      },
      childBookings: {
        select: {
          id: true,
          status: true,
          date: true,
          providerId: true,
          recipientRole: true,
          provider: { select: { firstName: true, name: true } },
        },
      },
    },
  });

  if (
    !booking ||
    (booking.customerId !== userId && booking.providerId !== userId)
  ) {
    return null;
  }

  // Anti-spam/safety (Prompt B7, VIỆC 4) — the provider only sees the
  // customer's contactPhone/locationAddress once they've actually
  // accepted the request; the customer always sees their own info back
  // (they typed it). Deliberately not gated on depositPaid — there's no
  // payment flow behind bookings, so requireDepositBeforeContact never
  // had a real trigger; this replaces that with the booking's own status.
  const viewerIsProvider = booking.providerId === userId;
  const contactInfoVisible = !viewerIsProvider || booking.status !== "PENDING";

  // First-time-pair safety notice (Prompt B7, VIỆC 4) — checked
  // regardless of who was customer/provider in the prior booking(s), so
  // two people who've worked together before (in either direction) don't
  // see the notice again.
  const priorBookingCount = await db.booking.count({
    where: {
      id: { not: booking.id },
      OR: [
        { customerId: booking.customerId, providerId: booking.providerId },
        { customerId: booking.providerId, providerId: booking.customerId },
      ],
    },
  });

  return {
    ...booking,
    contactPhone: contactInfoVisible ? booking.contactPhone : null,
    locationAddress: contactInfoVisible ? booking.locationAddress : null,
    isFirstBookingBetweenParties: priorBookingCount === 0,
  };
}

export class BookingActionError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "BookingActionError";
  }
}

export async function createBooking(
  customerId: string,
  input: CreateBookingInput,
) {
  if (input.providerId === customerId) {
    throw new BookingActionError("You can't book yourself", 400);
  }

  const date = new Date(`${input.date}T00:00:00.000Z`);
  const slotInstant = Date.parse(`${input.date}T${input.startTime}:00.000Z`);
  if (slotInstant < Date.now() + MIN_NOTICE_HOURS * 60 * 60 * 1000) {
    throw new BookingActionError(
      `Bookings need at least ${MIN_NOTICE_HOURS} hours notice`,
      400,
    );
  }

  // Anti-spam (Prompt B7, VIỆC 4) — checked at the service layer, not
  // just the UI, same principle as every other server-side validation in
  // this app.
  const pendingCount = await db.booking.count({
    where: { customerId, status: "PENDING" },
  });
  if (pendingCount >= MAX_PENDING_BOOKINGS_PER_USER) {
    throw new BookingActionError(
      `You already have ${MAX_PENDING_BOOKINGS_PER_USER} pending requests — wait for a response before sending more`,
      400,
    );
  }

  const service = input.serviceId
    ? await db.service.findUnique({
        where: { id: input.serviceId },
        include: { profile: { select: { role: true } } },
      })
    : null;
  if (input.serviceId && !service) {
    throw new BookingActionError("Service not found", 404);
  }

  // Crew-hire (Prompt B7, VIỆC 1) — "Gắn vào đơn khách hàng": the
  // requester (a Photographer/Videographer) attaches this booking to one
  // of their own CONFIRMED bookings-as-provider (the end-client job this
  // crew hire is for). Deliberately NOT auto-derived — the requester
  // picks it explicitly, since they may be working multiple jobs at once.
  if (input.parentBookingId) {
    const parent = await db.booking.findUnique({
      where: { id: input.parentBookingId },
    });
    if (
      !parent ||
      parent.providerId !== customerId ||
      parent.status !== "CONFIRMED"
    ) {
      throw new BookingActionError(
        "Invalid parent booking — must be one of your own confirmed bookings",
        400,
      );
    }
  }

  const provider = await db.user.findUnique({
    where: { id: input.providerId },
    select: { location: true },
  });

  const duration = service?.duration ?? 60;
  const startMinutes =
    Number(input.startTime.slice(0, 2)) * 60 + Number(input.startTime.slice(3));
  const endMinutes = startMinutes + duration;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

  const booking = await db.$transaction(async (tx) => {
    // Race-condition guard: re-check for an overlapping PENDING/CONFIRMED
    // booking for this provider inside the transaction, right before
    // insert, so two customers racing for the same slot can't both win.
    const existing = await tx.booking.findMany({
      where: {
        providerId: input.providerId,
        status: { in: ["PENDING", "CONFIRMED"] },
        date,
      },
      select: { startTime: true, service: { select: { duration: true } } },
    });

    const overlaps = existing.some((b) => {
      const bStart =
        Number(b.startTime.slice(0, 2)) * 60 + Number(b.startTime.slice(3));
      const bEnd = bStart + (b.service?.duration ?? 60);
      return startMinutes < bEnd && endMinutes > bStart;
    });
    if (overlaps) {
      throw new BookingActionError(
        "That time slot was just booked — pick another",
        409,
      );
    }

    // No BookingStatusHistory row here — that table records transitions
    // (see transitionBooking below), and creation isn't one; the row's
    // own createdAt is the "requested" timestamp.
    return tx.booking.create({
      data: {
        customerId,
        providerId: input.providerId,
        serviceId: input.serviceId,
        date,
        startTime: input.startTime,
        endTime,
        locationType: input.locationType,
        locationAddress: input.locationAddress,
        numberOfPeople: input.numberOfPeople,
        notes: input.notes,
        contactPhone: input.contactPhone,
        referenceImages: input.referenceImages ?? [],
        totalPrice: service?.price,
        currency: service?.currency ?? "VND",
        expiresAt: new Date(Date.now() + BOOKING_EXPIRY_HOURS * 60 * 60 * 1000),
        provinceCode: provider?.location ?? undefined,
        parentBookingId: input.parentBookingId,
        requesterRole: input.requesterRole ?? "CUSTOMER",
        recipientRole: service?.profile.role,
      },
      include: BOOKING_INCLUDE,
    });
  });

  const createEmailT = await getEmailT();
  await notify({
    userId: booking.providerId,
    type: "BOOKING_REQUEST",
    title: "New booking request",
    message: `${partyName(booking.customer)} requested ${booking.service?.name ?? "a session"} on ${dateLabel(booking.date)}`,
    data: { bookingId: booking.id },
    email: {
      subject: `New booking request — Fgrapher`,
      html: bookingRequestEmailHtml({
        t: createEmailT,
        otherPartyName: partyName(booking.customer),
        serviceName: booking.service?.name ?? "a session",
        dateLabel: dateLabel(booking.date),
        timeLabel: booking.startTime,
        bookingUrl: bookingUrlFor(booking.id),
      }),
    },
  });

  const conversationId = await getOrCreateConversation(
    booking.customerId,
    booking.providerId,
  );
  await sendMessage({
    conversationId,
    senderId: booking.customerId,
    content: `Booking request: ${booking.service?.name ?? "Custom request"} on ${dateLabel(booking.date)} at ${booking.startTime}`,
    type: "booking_link",
    bookingId: booking.id,
  });

  return booking;
}

// Prompt B7, VIỆC 3 — the single source of truth for which status moves
// are legal. Every other terminal status (DECLINED/CANCELLED/COMPLETED/
// NO_SHOW/EXPIRED) has no outgoing transitions.
const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  DECLINED: [],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  EXPIRED: [],
};

// Prompt B7, VIỆC 3 — the ONLY function that ever writes Booking.status.
// createBooking's initial PENDING insert is the one exception (that's a
// creation, not a transition). actorId is null exclusively for the
// system/cron-triggered EXPIRED transition (see expireBookings below) —
// every human-triggered call must pass a real userId.
export async function transitionBooking({
  bookingId,
  toStatus,
  actorId,
  note,
}: {
  bookingId: string;
  toStatus: BookingStatus;
  actorId: string | null;
  note?: string;
}) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      ...BOOKING_INCLUDE,
      childBookings: { select: { id: true, providerId: true } },
    },
  });
  if (!booking) {
    throw new BookingActionError("Booking not found", 404);
  }

  const allowed = VALID_TRANSITIONS[booking.status] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new BookingActionError(
      `A ${booking.status} booking can't move to ${toStatus}`,
      400,
    );
  }

  const isProvider = booking.providerId === actorId;
  const isCustomer = booking.customerId === actorId;

  if (actorId === null) {
    if (toStatus !== "EXPIRED") {
      throw new BookingActionError(
        "The system actor can only expire bookings",
        403,
      );
    }
  } else {
    if (toStatus === "EXPIRED") {
      throw new BookingActionError(
        "This transition can only be made automatically",
        403,
      );
    }
    if (!isProvider && !isCustomer) {
      throw new BookingActionError(
        "You are not a participant in this booking",
        403,
      );
    }
    if ((toStatus === "CONFIRMED" || toStatus === "DECLINED") && !isProvider) {
      throw new BookingActionError(
        "Only the provider can accept or decline a booking",
        403,
      );
    }
    if ((toStatus === "COMPLETED" || toStatus === "NO_SHOW") && !isProvider) {
      throw new BookingActionError(
        "Only the provider can report this outcome",
        403,
      );
    }
    const isPastBookingDate = new Date(booking.date).getTime() < Date.now();
    if (
      (toStatus === "COMPLETED" || toStatus === "NO_SHOW") &&
      !isPastBookingDate
    ) {
      throw new BookingActionError(
        "Can't report an outcome before the booking date",
        400,
      );
    }
  }

  const fromStatus = booking.status;
  const [updated] = await db.$transaction([
    db.booking.update({
      where: { id: bookingId },
      data: {
        status: toStatus,
        ...(toStatus === "CANCELLED"
          ? { cancelledBy: actorId, cancelReason: note }
          : {}),
        ...(toStatus === "DECLINED" ? { cancelReason: note } : {}),
        ...(toStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
      include: BOOKING_INCLUDE,
    }),
    db.bookingStatusHistory.create({
      data: { bookingId, fromStatus, toStatus, actorId, note },
    }),
  ]);

  if (actorId !== null) {
    const recipient = isProvider ? updated.customer : updated.provider;
    const actor = isProvider ? updated.provider : updated.customer;
    const serviceName = updated.service?.name ?? "a session";
    const emailArgs = {
      t: await getEmailT(),
      otherPartyName: partyName(actor),
      serviceName,
      dateLabel: dateLabel(updated.date),
      timeLabel: updated.startTime,
      bookingUrl: bookingUrlFor(updated.id),
    };

    if (toStatus === "CONFIRMED") {
      await notify({
        userId: recipient.id,
        type: "BOOKING_CONFIRMED",
        title: "Booking confirmed",
        message: `${emailArgs.otherPartyName} confirmed ${serviceName} on ${emailArgs.dateLabel}`,
        data: { bookingId: updated.id },
        email: {
          subject: "Booking confirmed — Fgrapher",
          html: bookingConfirmedEmailHtml(emailArgs),
        },
      });
    } else if (toStatus === "DECLINED") {
      await notify({
        userId: recipient.id,
        type: "BOOKING_DECLINED",
        title: "Booking declined",
        message: `${emailArgs.otherPartyName} declined your request for ${serviceName}`,
        data: { bookingId: updated.id },
        email: {
          subject: "Booking declined — Fgrapher",
          html: bookingDeclinedEmailHtml(emailArgs),
        },
      });
    } else if (toStatus === "CANCELLED") {
      await notify({
        userId: recipient.id,
        type: "BOOKING_CANCELLED",
        title: "Booking cancelled",
        message: `${emailArgs.otherPartyName} cancelled ${serviceName} on ${emailArgs.dateLabel}`,
        data: { bookingId: updated.id },
        email: {
          subject: "Booking cancelled — Fgrapher",
          html: bookingCancelledEmailHtml(emailArgs),
        },
      });

      // Crew-hire (Prompt B7, VIỆC 1) — cancelling a parent booking does
      // NOT cascade to its children. The MUA/Model/Studio already held
      // that slot; auto-cancelling would cost them the job through no
      // fault of their own. Only the child's provider is notified, so
      // they can decide for themselves whether to also cancel.
      for (const child of booking.childBookings) {
        await notify({
          userId: child.providerId,
          type: "BOOKING_CANCELLED",
          title: "Related job cancelled",
          message: `The client booking this job was attached to was cancelled. Your booking is unaffected — you can decide whether to cancel it too.`,
          data: { bookingId: child.id, relatedBookingId: updated.id },
        });
      }
    } else if (toStatus === "COMPLETED") {
      await notify({
        userId: recipient.id,
        type: "BOOKING_COMPLETED",
        title: "Booking completed",
        message: `Your ${serviceName} session is marked complete — leave a review`,
        data: { bookingId: updated.id },
      });
    } else if (toStatus === "NO_SHOW") {
      await notify({
        userId: recipient.id,
        type: "BOOKING_CANCELLED",
        title: "Marked as no-show",
        message: `Your ${serviceName} booking was marked as a no-show`,
        data: { bookingId: updated.id },
      });
    }
  } else if (toStatus === "EXPIRED") {
    // System-triggered — notify both parties, not just "the other one".
    await notify({
      userId: updated.customerId,
      type: "BOOKING_CANCELLED",
      title: "Booking request expired",
      message: `Your request for ${updated.service?.name ?? "a session"} with ${partyName(updated.provider)} expired without a response`,
      data: { bookingId: updated.id },
    });
    await notify({
      userId: updated.providerId,
      type: "BOOKING_CANCELLED",
      title: "Booking request expired",
      message: `A request from ${partyName(updated.customer)} for ${updated.service?.name ?? "a session"} expired`,
      data: { bookingId: updated.id },
    });
  }

  return updated;
}

export async function proposeReschedule({
  bookingId,
  userId,
  date,
  startTime,
  endTime,
}: {
  bookingId: string;
  userId: string;
  date: string;
  startTime: string;
  endTime?: string;
}) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: BOOKING_INCLUDE,
  });
  if (!booking) throw new BookingActionError("Booking not found", 404);

  const isProvider = booking.providerId === userId;
  const isCustomer = booking.customerId === userId;
  if (!isProvider && !isCustomer) {
    throw new BookingActionError(
      "You are not a participant in this booking",
      403,
    );
  }
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    throw new BookingActionError(
      "This booking can no longer be rescheduled",
      400,
    );
  }

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: {
      rescheduleProposedDate: new Date(`${date}T00:00:00.000Z`),
      rescheduleProposedStartTime: startTime,
      rescheduleProposedEndTime: endTime,
      rescheduleProposedBy: userId,
    },
    include: BOOKING_INCLUDE,
  });

  const recipient = isProvider ? updated.customer : updated.provider;
  const actor = isProvider ? updated.provider : updated.customer;
  await notify({
    userId: recipient.id,
    type: "BOOKING_RESCHEDULE_PROPOSED",
    title: "New time proposed",
    message: `${partyName(actor)} proposed rescheduling to ${dateLabel(updated.rescheduleProposedDate!)} at ${startTime}`,
    data: { bookingId: updated.id },
  });

  return updated;
}

// Called once a day by /api/cron/booking-reminders. Reminds both parties of
// any CONFIRMED booking scheduled for tomorrow (UTC-anchored date match,
// consistent with the rest of the app) that hasn't been reminded yet —
// `reminderSentAt` makes re-running the cron for the same day a no-op.
export async function sendBookingReminders() {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const from = new Date(
    Date.UTC(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth(),
      tomorrow.getUTCDate(),
    ),
  );
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);

  const bookings = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      date: { gte: from, lt: to },
      reminderSentAt: null,
    },
    include: BOOKING_INCLUDE,
  });

  // Cron-triggered, no request/cookie context to resolve a locale from —
  // explicit "vi" default (CLAUDE.md rule 10), same as transitionBooking's
  // system-actor (EXPIRED) branch.
  const reminderEmailT = await getEmailT("vi");

  for (const booking of bookings) {
    const args = (recipientIsProvider: boolean) => ({
      t: reminderEmailT,
      otherPartyName: partyName(
        recipientIsProvider ? booking.customer : booking.provider,
      ),
      serviceName: booking.service?.name ?? "a session",
      dateLabel: dateLabel(booking.date),
      timeLabel: booking.startTime,
      bookingUrl: bookingUrlFor(booking.id),
    });

    await notify({
      userId: booking.customerId,
      type: "BOOKING_REMINDER",
      title: "Booking tomorrow",
      message: `Your ${booking.service?.name ?? "session"} with ${partyName(booking.provider)} is tomorrow at ${booking.startTime}`,
      data: { bookingId: booking.id },
      email: {
        subject: "Booking tomorrow — Fgrapher",
        html: bookingReminderEmailHtml(args(false)),
      },
    });
    await notify({
      userId: booking.providerId,
      type: "BOOKING_REMINDER",
      title: "Booking tomorrow",
      message: `Your ${booking.service?.name ?? "session"} with ${partyName(booking.customer)} is tomorrow at ${booking.startTime}`,
      data: { bookingId: booking.id },
      email: {
        subject: "Booking tomorrow — Fgrapher",
        html: bookingReminderEmailHtml(args(true)),
      },
    });

    await db.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return bookings.length;
}

// Prompt B7, VIỆC 2 — called hourly by /api/cron/expire-bookings. Moves
// every PENDING booking past its expiresAt to EXPIRED through
// transitionBooking (system actor), so the transition still gets state-
// machine validation, a BookingStatusHistory row, and notifications to
// both parties, same as any other status change.
export async function expireBookings() {
  const due = await db.booking.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true },
  });

  for (const booking of due) {
    await transitionBooking({
      bookingId: booking.id,
      toStatus: "EXPIRED",
      actorId: null,
    });
  }

  return due.length;
}

export async function respondToReschedule({
  bookingId,
  userId,
  accept,
}: {
  bookingId: string;
  userId: string;
  accept: boolean;
}) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: BOOKING_INCLUDE,
  });
  if (!booking) throw new BookingActionError("Booking not found", 404);
  if (!booking.rescheduleProposedBy) {
    throw new BookingActionError("No pending reschedule proposal", 400);
  }
  if (booking.rescheduleProposedBy === userId) {
    throw new BookingActionError("Wait for the other party to respond", 400);
  }

  const isProvider = booking.providerId === userId;
  const isCustomer = booking.customerId === userId;
  if (!isProvider && !isCustomer) {
    throw new BookingActionError(
      "You are not a participant in this booking",
      403,
    );
  }

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: accept
      ? {
          date: booking.rescheduleProposedDate!,
          startTime: booking.rescheduleProposedStartTime!,
          endTime: booking.rescheduleProposedEndTime ?? booking.endTime,
          rescheduleProposedDate: null,
          rescheduleProposedStartTime: null,
          rescheduleProposedEndTime: null,
          rescheduleProposedBy: null,
        }
      : {
          rescheduleProposedDate: null,
          rescheduleProposedStartTime: null,
          rescheduleProposedEndTime: null,
          rescheduleProposedBy: null,
        },
    include: BOOKING_INCLUDE,
  });

  const proposer =
    booking.rescheduleProposedBy === booking.providerId
      ? updated.provider
      : updated.customer;
  await notify({
    userId: proposer.id,
    type: accept ? "BOOKING_CONFIRMED" : "BOOKING_DECLINED",
    title: accept ? "Reschedule accepted" : "Reschedule declined",
    message: accept
      ? `Your proposed time for ${updated.service?.name ?? "the booking"} was accepted`
      : `Your proposed new time for ${updated.service?.name ?? "the booking"} was declined`,
    data: { bookingId: updated.id },
  });

  return updated;
}
