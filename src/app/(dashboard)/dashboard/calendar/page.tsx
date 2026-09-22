import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PROVIDER_ROLES } from "@/lib/constants";
import { listBlockedDates } from "@/services/availability";
import { listWeeklyRules } from "@/services/resource-calendar";
import { listBookingsForRange } from "@/services/bookings";

import { CalendarClient } from "./calendar-client";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.user.roles.some((role) => PROVIDER_ROLES.includes(role))) {
    redirect("/dashboard");
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [bookings, blockedDates, weeklySchedule] = await Promise.all([
    listBookingsForRange({ providerId: session.user.id, from, to }),
    listBlockedDates(session.user.id, from, to),
    listWeeklyRules(session.user.id),
  ]);

  return (
    <CalendarClient
      initialBookings={bookings}
      initialBlockedDates={blockedDates.map((b) => ({
        id: b.id,
        date: b.dateKey,
        reason: b.reason,
        startTime: b.startTime,
        endTime: b.endTime,
      }))}
      initialWeeklySchedule={weeklySchedule}
    />
  );
}
