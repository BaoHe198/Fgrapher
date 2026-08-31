import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listBlockedDates } from "@/services/availability";
import { listBookingsForRange } from "@/services/bookings";

import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [bookings, blockedDates, weeklySchedule] = await Promise.all([
    listBookingsForRange({ providerId: session.user.id, from, to }),
    listBlockedDates(session.user.id, from, to),
    db.availability.findMany({
      where: { userId: session.user.id },
      orderBy: { dayOfWeek: "asc" },
    }),
  ]);

  return (
    <CalendarClient
      initialBookings={bookings}
      initialBlockedDates={blockedDates.map((b) => ({
        id: b.id,
        date: b.date.toISOString().slice(0, 10),
        reason: b.reason,
        startTime: b.startTime,
        endTime: b.endTime,
      }))}
      initialWeeklySchedule={weeklySchedule}
    />
  );
}
