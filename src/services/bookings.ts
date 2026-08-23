import type { BookingStatus } from "@prisma/client";

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

const PAGE_SIZE = 20;
const MIN_NOTICE_HOURS = 24;

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
      ? { status: { in: ["CANCELLED", "DECLINED"] as BookingStatus[] } }
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
    bookings,
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
  return db.booking.findMany({
    where: {
      providerId,
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
      date: { gte: from, lt: to },
    },
    orderBy: { date: "asc" },
    include: BOOKING_INCLUDE,
  });
}

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
          roles: {
            where: { verificationStatus: "VERIFIED" },
            select: { role: true },
            take: 1,
          },
        },
      },
      service: { select: { name: true, description: true, duration: true } },
      review: { select: { id: true } },
    },
  });

  if (
    !booking ||
    (booking.customerId !== userId && booking.providerId !== userId)
  ) {
    return null;
  }

  return booking;
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

  const service = input.serviceId
    ? await db.service.findUnique({ where: { id: input.serviceId } })
    : null;
  if (input.serviceId && !service) {
    throw new BookingActionError("Service not found", 404);
  }

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
      },
      include: BOOKING_INCLUDE,
    });
  });

  await notify({
    userId: booking.providerId,
    type: "BOOKING_REQUEST",
    title: "New booking request",
    message: `${partyName(booking.customer)} requested ${booking.service?.name ?? "a session"} on ${dateLabel(booking.date)}`,
    data: { bookingId: booking.id },
    email: {
      subject: `New booking request — Fgrapher`,
      html: bookingRequestEmailHtml({
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

export async function updateBookingStatus({
  bookingId,
  userId,
  status,
  cancelReason,
}: {
  bookingId: string;
  userId: string;
  status: "CONFIRMED" | "DECLINED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  cancelReason?: string;
}) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: BOOKING_INCLUDE,
  });

  if (!booking) {
    throw new BookingActionError("Booking not found", 404);
  }

  const isProvider = booking.providerId === userId;
  const isCustomer = booking.customerId === userId;
  if (!isProvider && !isCustomer) {
    throw new BookingActionError(
      "You are not a participant in this booking",
      403,
    );
  }

  if ((status === "CONFIRMED" || status === "DECLINED") && !isProvider) {
    throw new BookingActionError(
      "Only the provider can accept or decline a booking",
      403,
    );
  }
  if ((status === "COMPLETED" || status === "NO_SHOW") && !isProvider) {
    throw new BookingActionError(
      "Only the provider can report this outcome",
      403,
    );
  }

  const isPastBookingDate = new Date(booking.date).getTime() < Date.now();
  if ((status === "COMPLETED" || status === "NO_SHOW") && !isPastBookingDate) {
    throw new BookingActionError(
      "Can't report an outcome before the booking date",
      400,
    );
  }

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: {
      status,
      ...(status === "CANCELLED" ? { cancelledBy: userId, cancelReason } : {}),
      ...(status === "DECLINED" ? { cancelReason } : {}),
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
    include: BOOKING_INCLUDE,
  });

  const recipient = isProvider ? updated.customer : updated.provider;
  const actor = isProvider ? updated.provider : updated.customer;
  const serviceName = updated.service?.name ?? "a session";
  const emailArgs = {
    otherPartyName: partyName(actor),
    serviceName,
    dateLabel: dateLabel(updated.date),
    timeLabel: updated.startTime,
    bookingUrl: bookingUrlFor(updated.id),
  };

  if (status === "CONFIRMED") {
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
  } else if (status === "DECLINED") {
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
  } else if (status === "CANCELLED") {
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
  } else if (status === "COMPLETED") {
    await notify({
      userId: recipient.id,
      type: "BOOKING_COMPLETED",
      title: "Booking completed",
      message: `Your ${serviceName} session is marked complete — leave a review`,
      data: { bookingId: updated.id },
    });
  } else if (status === "NO_SHOW") {
    await notify({
      userId: recipient.id,
      type: "BOOKING_CANCELLED",
      title: "Marked as no-show",
      message: `Your ${serviceName} booking was marked as a no-show`,
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

  for (const booking of bookings) {
    const args = (recipientIsProvider: boolean) => ({
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
