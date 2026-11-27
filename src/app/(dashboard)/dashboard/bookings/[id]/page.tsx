import { asApiJson, sessionForPage } from "@/lib/auth-helpers";
import { getBookingDetail } from "@/services/bookings";

import {
  BookingDetailClient,
  type BookingDetail,
} from "./booking-detail-client";

// The booking is read here, with the page (27/11/2026). The screen used to
// be a Client Component that opened on a skeleton and then asked
// GET /api/bookings/[id] for the booking: a second trip to the server, with
// its own sign-in check, before anything useful was on screen.
export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The same gate and the same reader as GET /api/bookings/[id], so what a
  // viewer may see is decided in one place: getBookingDetail hides the
  // customer's phone and address from a provider who has not accepted, and
  // returns null to anyone who is not a party to the booking.
  const session = await sessionForPage();
  if (!session) return null;

  const booking = await getBookingDetail(id, session.user.id);

  return (
    <BookingDetailClient
      // Another booking is another screen: start it from its own data, not
      // from the state of the one shown before.
      key={id}
      initialBooking={booking ? asApiJson<BookingDetail>(booking) : null}
    />
  );
}
