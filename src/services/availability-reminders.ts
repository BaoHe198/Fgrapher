import { getTranslations } from "next-intl/server";

import { appUrl } from "@/lib/app-url";
import { PAID_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { availabilityReminderEmailHtml } from "@/lib/email";
import { vietnamDateKey } from "@/lib/vietnam-date";
import { notify } from "@/services/notification";

const DELIVERY_CONCURRENCY = 10;

/**
 * Daily 07:30 Vietnam-time reminder for providers who are currently visible
 * and accepting bookings. Deterministic notification ids and email keys make
 * a retry of the same day's cron harmless.
 */
export async function sendAvailabilityUpdateReminders(now = new Date()) {
  const providers = await db.user.findMany({
    where: {
      deletedAt: null,
      isSuspended: false,
      acceptingBookings: true,
      roles: {
        some: {
          active: true,
          role: { in: PAID_ROLES },
          verificationStatus: "VERIFIED",
        },
      },
      profiles: {
        some: { isPublished: true, role: { in: PAID_ROLES } },
      },
    },
    select: { id: true },
  });

  const [emailT, notificationT] = await Promise.all([
    getTranslations({ locale: "vi", namespace: "libServices.email" }),
    getTranslations({ locale: "vi", namespace: "libServices.notifications" }),
  ]);
  const dateKey = vietnamDateKey(now);
  const calendarUrl = appUrl("/dashboard/calendar");

  for (let index = 0; index < providers.length; index += DELIVERY_CONCURRENCY) {
    await Promise.all(
      providers.slice(index, index + DELIVERY_CONCURRENCY).map((provider) =>
        notify({
          notificationId: `availability-reminder:${dateKey}:${provider.id}`,
          userId: provider.id,
          type: "AVAILABILITY_REMINDER",
          title: notificationT("availabilityReminder.title"),
          message: notificationT("availabilityReminder.message"),
          data: { href: "/dashboard/calendar", dateKey },
          email: {
            subject: emailT("availabilityReminder.subject"),
            html: availabilityReminderEmailHtml({
              t: emailT,
              calendarUrl,
            }),
            dedupe: [dateKey],
          },
        }),
      ),
    );
  }

  return providers.length;
}
