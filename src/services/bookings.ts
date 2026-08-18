import type { BookingStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const PAGE_SIZE = 20;

export type BookingTab = "ALL" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

const BOOKING_INCLUDE = {
  customer: { select: { id: true, name: true, firstName: true, avatar: true, email: true } },
  provider: { select: { id: true, name: true, firstName: true, avatar: true, email: true } },
  service: { select: { name: true } },
} as const;

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

  return { bookings, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export class BookingActionError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "BookingActionError";
  }
}

export async function updateBookingStatus({
  bookingId,
  userId,
  status,
  cancelReason,
}: {
  bookingId: string;
  userId: string;
  status: "CONFIRMED" | "DECLINED" | "CANCELLED" | "COMPLETED";
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
    throw new BookingActionError("You are not a participant in this booking", 403);
  }

  if ((status === "CONFIRMED" || status === "DECLINED") && !isProvider) {
    throw new BookingActionError("Only the provider can accept or decline a booking", 403);
  }

  if (status === "COMPLETED" && !isProvider) {
    throw new BookingActionError("Only the provider can mark a booking complete", 403);
  }

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: {
      status,
      ...(status === "CANCELLED" ? { cancelledBy: userId, cancelReason } : {}),
      ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
    include: BOOKING_INCLUDE,
  });

  const recipient = isProvider ? updated.customer : updated.provider;
  const recipientName = recipient.firstName ?? recipient.name ?? "there";
  await sendEmail({
    to: recipient.email,
    subject: `Booking ${status.toLowerCase()} — Fgrapher`,
    html: `<p>Hi ${recipientName},</p><p>Your Fgrapher booking on ${updated.date.toDateString()} is now <strong>${status}</strong>.</p>`,
  });

  return updated;
}
