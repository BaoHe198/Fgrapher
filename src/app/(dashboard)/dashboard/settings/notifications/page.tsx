import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROVIDER_ROLES } from "@/lib/constants";
import { features } from "@/lib/features";
import type { NotificationPreferences } from "@/lib/validations/user";

import { NotificationsSettings } from "./notifications-settings";

export default async function NotificationsSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { roles: { where: { active: true }, select: { role: true } } },
  });
  // Only an account that takes bookings gets asked for them or reminded to
  // keep a calendar current; everyone else is on the customer side.
  const receivesBookings = user.roles.some((r) =>
    PROVIDER_ROLES.includes(r.role),
  );

  return (
    <NotificationsSettings
      initialPreferences={
        user.notificationPreferences as NotificationPreferences | null
      }
      // Feature-flag state resolved here (server) — the client component
      // must not import lib/features.ts (→ lib/env.ts) into the browser
      // bundle.
      socialFeedEnabled={features.socialFeedEnabled}
      receivesBookings={receivesBookings}
    />
  );
}
