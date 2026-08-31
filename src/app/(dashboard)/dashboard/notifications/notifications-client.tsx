"use client";

import type { Notification, NotificationType } from "@prisma/client";
import { Bell, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type FilterTab =
  "ALL" | "UNREAD" | "BOOKINGS" | "ORDERS" | "MESSAGES" | "SOCIAL";

const TAB_VALUES: FilterTab[] = [
  "ALL",
  "UNREAD",
  "BOOKINGS",
  "ORDERS",
  "MESSAGES",
  "SOCIAL",
];

const TYPE_GROUP: Record<
  NotificationType,
  "BOOKINGS" | "ORDERS" | "MESSAGES" | "SOCIAL" | "OTHER"
> = {
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
  NEW_ORDER: "ORDERS",
  ORDER_CONFIRMED: "ORDERS",
  ORDER_SHIPPED: "ORDERS",
  ORDER_DELIVERED: "ORDERS",
  ORDER_CANCELLED: "ORDERS",
  REVIEW_RESPONSE: "SOCIAL",
  MEDIA_APPROVED: "OTHER",
  MEDIA_REJECTED: "OTHER",
  REQUEST_NEW_MATCH: "OTHER",
  REQUEST_NEW_OFFER: "OTHER",
  REQUEST_OFFER_ACCEPTED: "OTHER",
  REQUEST_OFFER_DECLINED: "OTHER",
  REQUEST_NO_OFFERS_48H: "OTHER",
};

function relativeTime(
  date: string | Date,
  t: (key: string, values?: Record<string, number>) => string,
) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return t("justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("minutesAgo", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { hours });
  const days = Math.floor(hours / 24);
  return t("daysAgo", { days });
}

function notificationHref(notification: Notification) {
  const data = notification.data as {
    bookingId?: string;
    orderId?: string;
  } | null;
  if (data?.bookingId) return `/dashboard/bookings/${data.bookingId}`;
  if (data?.orderId) return `/dashboard/orders/${data.orderId}`;
  return "/dashboard/notifications";
}

export function NotificationsClient({
  initialNotifications,
}: {
  initialNotifications: Notification[];
}) {
  const t = useTranslations("dashboardCore.notifications");
  const TABS: { value: FilterTab; label: string }[] = TAB_VALUES.map(
    (value) => ({ value, label: t(`tabs.${value}`) }),
  );
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications);
  const [isLoading, setIsLoading] = useState(false);
  // The "ALL" tab's first page was already fetched server-side (see
  // page.tsx) — skip the redundant client refetch on mount and only hit
  // the API when the tab actually changes afterward.
  const isFirstRender = useRef(true);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/notifications?${tab === "UNREAD" ? "unread=true" : ""}`,
    );
    const body = await res.json();
    startTransition(() => {
      setNotifications(body.data ?? []);
      setIsLoading(false);
    });
  }, [tab]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    startTransition(() => setIsLoading(true));
    load();
  }, [load]);

  const visible =
    tab === "ALL" || tab === "UNREAD"
      ? notifications
      : notifications.filter((n) => TYPE_GROUP[n.type] === tab);

  const onClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
    }
    router.push(notificationHref(notification));
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>

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
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("empty.title")}
          </p>
          <p className="text-body-md text-text-secondary">{t("empty.body")}</p>
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
              <span className="text-body-md font-semibold! text-text-primary">
                {notification.title}
              </span>
              <span className="text-body-sm text-text-secondary">
                {notification.message}
              </span>
              <span className="text-body-sm text-text-tertiary">
                {relativeTime(notification.createdAt, t)}
              </span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
