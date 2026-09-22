import type { BookingStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * A booking holds a slot while it is PENDING or CONFIRMED and at no other
 * time. Everything else — declined, cancelled, expired, completed, no-show —
 * releases it.
 *
 * This list is the reason `booking_allocations_no_overlap` can be an
 * unconditional exclusion constraint: the rows only exist while the hold is
 * real, so the constraint never has to reason about booking status.
 */
export const HOLDING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

/** Postgres raises this when the overlap constraint refuses a write. */
export const OVERLAP_CONSTRAINT = "booking_allocations_no_overlap";

export function isOverlapViolation(error: unknown) {
  return error instanceof Error && error.message.includes(OVERLAP_CONSTRAINT);
}

/**
 * The resource whose calendar a provider's bookings occupy. Phase 1 gives
 * every provider profile exactly one, created with the profile; this returns
 * null for an account that has none — a customer, an admin, or a shop, none
 * of which take bookings.
 */
export async function providerResourceId(
  providerId: string,
  tx: Prisma.TransactionClient = db,
) {
  const resource = await tx.bookableResource.findFirst({
    where: {
      profile: { userId: providerId },
      type: "PROVIDER_SELF",
      isActive: true,
    },
    select: { id: true },
  });
  return resource?.id ?? null;
}

/**
 * Writes the hold for a booking. Must run inside the same transaction as the
 * booking insert: a booking that exists without its hold is a booking the
 * database is not protecting.
 *
 * A booking with no end time counts as one hour, which is what the
 * availability engine already assumed for those rows.
 */
export async function holdSlot(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    providerId: string;
    startAt: Date;
    endAt: Date | null;
  },
) {
  const resourceId = await providerResourceId(input.providerId, tx);
  if (!resourceId) return null;

  return tx.bookingAllocation.create({
    data: {
      bookingId: input.bookingId,
      resourceId,
      startAt: input.startAt,
      endAt: input.endAt ?? new Date(input.startAt.getTime() + 3_600_000),
    },
  });
}

/** Releases whatever hold a booking had. Safe to call when it had none. */
export async function releaseSlot(
  bookingId: string,
  tx: Prisma.TransactionClient = db,
) {
  await tx.bookingAllocation.deleteMany({ where: { bookingId } });
}
