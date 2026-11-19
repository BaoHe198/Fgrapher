import { db } from "@/lib/db";
import { vietnamDateStart } from "@/lib/vietnam/date";
import { transitionBooking } from "@/services/bookings";
import { withdrawOffer } from "@/services/request-offers";
import { cancelServiceRequest } from "@/services/service-requests";

/**
 * Everything an account still has in motion with OTHER people, closed the
 * way the account's owner would have closed it by hand, before the account
 * is anonymised.
 *
 * processDeletion() used to anonymise the user and stop there. What was
 * still live stayed live with nobody behind it: an open F Booking request
 * kept collecting offers (and kept its street address), a pending offer
 * could still be accepted — producing a booking with "Người dùng đã xóa" —
 * and an upcoming booking stayed on the other party's calendar without a
 * word. Found in the 19/11/2026 walkthrough.
 *
 * Each item goes through the function that already owns that change, so its
 * rules and its notifications to the other party apply unchanged:
 * transitionBooking() remains the only writer of Booking.status.
 *
 * Runs BEFORE the anonymising transaction on purpose: the people being told
 * should read who cancelled, not "Người dùng đã xóa". One failure does not
 * stop the rest — the deletion itself must still go through, and whatever is
 * left is logged for an admin to close by hand.
 */
export async function windDownAccount(userId: string) {
  const failures: { kind: string; id: string; error: unknown }[] = [];
  const attempt = async (
    kind: string,
    id: string,
    close: () => Promise<unknown>,
  ) => {
    try {
      await close();
    } catch (error) {
      failures.push({ kind, id, error });
    }
  };

  // Upcoming bookings only. One whose date has passed already happened (or
  // will be expired by the cron); cancelling it now would rewrite history
  // the other party is entitled to keep.
  const bookings = await db.booking.findMany({
    where: {
      OR: [{ customerId: userId }, { providerId: userId }],
      status: { in: ["PENDING", "CONFIRMED"] },
      date: { gte: vietnamDateStart() },
    },
    select: { id: true },
  });
  for (const booking of bookings) {
    await attempt("booking", booking.id, () =>
      transitionBooking({
        bookingId: booking.id,
        toStatus: "CANCELLED",
        actorId: userId,
        note: "Tài khoản đã được xóa theo yêu cầu của chủ tài khoản.",
      }),
    );
  }

  // Requests still waiting for review or for offers. cancelServiceRequest
  // closes the offers on them and tells the providers who made them.
  const requests = await db.serviceRequest.findMany({
    where: {
      customerId: userId,
      isDraft: false,
      status: { in: ["PENDING_REVIEW", "OPEN", "HAS_OFFERS"] },
    },
    select: { id: true },
  });
  for (const request of requests) {
    await attempt("request", request.id, () =>
      cancelServiceRequest(request.id, userId),
    );
  }

  // Offers this account made that a customer could still accept.
  const offers = await db.requestOffer.findMany({
    where: { providerId: userId, status: "PENDING" },
    select: { id: true },
  });
  for (const offer of offers) {
    await attempt("offer", offer.id, () => withdrawOffer(offer.id, userId));
  }

  if (failures.length > 0) {
    console.error("[Account deletion] Some activity could not be closed", {
      userId,
      failures,
    });
  }

  return {
    bookings: bookings.length,
    requests: requests.length,
    offers: offers.length,
    failed: failures.length,
  };
}
