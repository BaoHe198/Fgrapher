import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listNotifications } from "@/services/notification";

import { NotificationsClient } from "./notifications-client";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Only the default "ALL" tab's first page is worth fetching server-side
  // — every other tab (including client-side type filtering) is a fast
  // follow-up fetch from here, same as before.
  const { notifications } = await listNotifications({
    userId: session.user.id,
    unreadOnly: false,
    page: 1,
  });

  return <NotificationsClient initialNotifications={notifications} />;
}
