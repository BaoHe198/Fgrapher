import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listBookings } from "@/services/bookings";
import { isProviderRoleSet } from "@/services/dashboard";

import { BookingsClient } from "./bookings-client";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ side?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  // "Tiện ích khác → Lịch đặt tôi đã gửi" opens the other side of the list:
  // the people this provider booked. The client fetches that side itself.
  const isProvider = isProviderRoleSet(session.user.roles);
  const initialSide =
    isProvider && (await searchParams).side === "sent" ? "sent" : "received";

  // Only the default "ALL" tab's first page is worth fetching server-side
  // — tab switches and pagination stay client-side fetches from here.
  const { bookings, totalPages, counts } = await listBookings({
    userId: session.user.id,
    isProvider: isProvider && initialSide === "received",
    tab: "ALL",
    page: 1,
  });

  return (
    <BookingsClient
      initialBookings={bookings}
      initialTotalPages={totalPages}
      initialCounts={counts}
      initialSide={initialSide}
    />
  );
}
