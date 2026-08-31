import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listBookings } from "@/services/bookings";
import { isProviderRoleSet } from "@/services/dashboard";

import { BookingsClient } from "./bookings-client";

export default async function BookingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Only the default "ALL" tab's first page is worth fetching server-side
  // — tab switches and pagination stay client-side fetches from here.
  const { bookings, totalPages } = await listBookings({
    userId: session.user.id,
    isProvider: isProviderRoleSet(session.user.roles),
    tab: "ALL",
    page: 1,
  });

  return (
    <BookingsClient initialBookings={bookings} initialTotalPages={totalPages} />
  );
}
