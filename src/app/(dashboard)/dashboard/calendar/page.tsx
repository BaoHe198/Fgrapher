import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isDateKey, monthWindow, vietnamTodayKey } from "@/lib/calendar/agenda";
import { PROVIDER_ROLES } from "@/lib/constants";
import { listWeeklyRules } from "@/services/resource-calendar";
import { getWorkAgenda } from "@/services/work-calendar";

import { CalendarClient } from "./calendar-client";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (!session.user.roles.some((role) => PROVIDER_ROLES.includes(role))) {
    redirect("/dashboard");
  }

  // A reminder links to the day it is about (?date=2026-11-25); anything
  // else opens on today, Vietnam time.
  const todayKey = vietnamTodayKey();
  const { date } = await searchParams;
  const initialDate = isDateKey(date) ? date : todayKey;
  const range = monthWindow(initialDate);

  const [items, weeklySchedule] = await Promise.all([
    getWorkAgenda(session.user.id, range.from, range.to),
    listWeeklyRules(session.user.id),
  ]);

  return (
    <CalendarClient
      initialItems={items}
      initialDate={initialDate}
      todayKey={todayKey}
      weeklySchedule={weeklySchedule}
    />
  );
}
