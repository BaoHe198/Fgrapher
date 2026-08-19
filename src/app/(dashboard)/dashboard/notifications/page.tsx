"use client";

import type { Notification, NotificationType } from "@prisma/client";
import { Bell, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type FilterTab = "ALL" | "UNREAD" | "BOOKINGS" | "MESSAGES" | "SOCIAL";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
  { value: "BOOKINGS", label: "Bookings" },
  { value: "MESSAGES", label: "Messages" },
  { value: "SOCIAL", label: "Social" },
];

const TYPE_GROUP: Record<NotificationType, "BOOKINGS" | "MESSAGES" | "SOCIAL" | "OTHER"> = {
  BOOKING_REQUEST: "BOOKINGS",
  BOOKING_CONFIRMED: "BOOKINGS",
  BOOKING_DECLINED: "BOOKINGS",
  BOOKING_CANCELLED: "BOOKINGS",
  BOOKING_REMINDER: "BOOKINGS",
  BOOKING_RESCHEDULE_PROPOSED: "BOOKINGS",
  BOOKING_COMPLETED: "BOOKINGS",
  NEW_MESSAGE: "MESSAGES",
  NEW_FOLLOWER: "SOCIAL",
  NEW_REVIEW: "SOCIAL",
  NEW_LIKE: "SOCIAL",
  NEW_COMMENT: "SOCIAL",
  SUBSCRIPTION_ACTIVE: "OTHER",
  SUBSCRIPTION_EXPIRING: "OTHER",
  SUBSCRIPTION_CANCELLED: "OTHER",
  PAYMENT_FAILED: "OTHER",
};

function relativeTime(date: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function notificationHref(notification: Notification) {
  const data = notification.data as { bookingId?: string } | null;
  if (data?.bookingId) return `/dashboard/bookings/${data.bookingId}`;
  return "/dashboard/notifications";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/notifications?${tab === "UNREAD" ? "unread=true" : ""}`);
    const body = await res.json();
    startTransition(() => {
      setNotifications(body.data ?? []);
      setIsLoading(false);
    });
  }, [tab]);

  useEffect(() => {
    startTransition(() => setIsLoading(true));
    load();
  }, [load]);

  const visible =
    tab === "ALL" || tab === "UNREAD"
      ? notifications
      : notifications.filter((n) => TYPE_GROUP[n.type] === tab);

  const onClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await fetch(`/api/notifications/${notification.id}/read`, { method: "PATCH" });
    }
    router.push(notificationHref(notification));
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">Notifications</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as FilterTab)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTab key={t.value} value={t.value}>
              {t.label}
            </TabsTab>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsPanel key={t.value} value={t.value} />
        ))}
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Bell className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">No notifications</p>
          <p className="text-body-md text-text-secondary">You&apos;re all caught up.</p>
        </Card>
      ) : (
        <Card padding={false}>
          {visible.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => onClick(notification)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b border-border-subtle px-5 py-4 text-left last:border-b-0 hover:bg-bg-sunken",
                !notification.readAt && "bg-success-bg/40",
              )}
            >
              <span className="text-body-md font-semibold text-text-primary">
                {notification.title}
              </span>
              <span className="text-body-sm text-text-secondary">{notification.message}</span>
              <span className="text-body-sm text-text-tertiary">
                {relativeTime(notification.createdAt)}
              </span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
