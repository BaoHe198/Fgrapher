"use client";

import type { Notification, NotificationType } from "@prisma/client";
import {
  ArrowLeftRight,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarX,
  CreditCard,
  Handshake,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Package,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { usePolling } from "@/hooks/use-polling";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { useBadges } from "@/components/providers/badges-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { notificationHref } from "@/lib/notifications/href";

const ICONS: Record<NotificationType, typeof Bell> = {
  BOOKING_REQUEST: Calendar,
  BOOKING_CONFIRMED: CalendarCheck,
  BOOKING_DECLINED: CalendarX,
  BOOKING_CANCELLED: CalendarX,
  BOOKING_REMINDER: Calendar,
  AVAILABILITY_REMINDER: Calendar,
  BOOKING_RESCHEDULE_PROPOSED: Calendar,
  BOOKING_COMPLETED: CalendarCheck,
  NEW_MESSAGE: MessageCircle,
  NEW_FOLLOWER: UserPlus,
  NEW_REVIEW: Star,
  NEW_LIKE: Heart,
  NEW_COMMENT: MessageCircle,
  SUBSCRIPTION_ACTIVE: CreditCard,
  SUBSCRIPTION_EXPIRING: CreditCard,
  SUBSCRIPTION_CANCELLED: CreditCard,
  PAYMENT_FAILED: CreditCard,
  NEW_ORDER: Package,
  ORDER_CONFIRMED: Package,
  ORDER_SHIPPED: Package,
  ORDER_DELIVERED: Package,
  ORDER_CANCELLED: Package,
  PRODUCT_BACK_IN_STOCK: Package,
  REVIEW_RESPONSE: Star,
  MEDIA_APPROVED: ImageIcon,
  MEDIA_REJECTED: ImageIcon,
  REQUEST_NEW_MATCH: Handshake,
  REQUEST_NEW_OFFER: Handshake,
  REQUEST_OFFER_ACCEPTED: Handshake,
  REQUEST_OFFER_DECLINED: Handshake,
  REQUEST_NO_OFFERS_48H: Handshake,
  REQUEST_APPROVED: Handshake,
  REQUEST_REJECTED: Handshake,
  REQUEST_EXPIRED: Handshake,
  ROLE_CHANGE_APPROVED: ArrowLeftRight,
  ROLE_CHANGE_REJECTED: ArrowLeftRight,
  VERIFICATION_APPROVED: ShieldCheck,
  VERIFICATION_REJECTED: ShieldAlert,
  PLACE_APPROVED: MapPin,
  PLACE_REJECTED: MapPin,
};

function relativeTime(
  date: string | Date,
  labels: {
    justNow: string;
    minutesAgo: (n: number) => string;
    hoursAgo: (n: number) => string;
    daysAgo: (n: number) => string;
  },
) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return labels.justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return labels.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return labels.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return labels.daysAgo(days);
}

export function NotificationBell() {
  const t = useTranslations("sharedComponents.notificationBell");
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  // The badge number lives with the header's other badges (one request for
  // all three — see BadgesProvider). While the dropdown is shut this
  // component fetches nothing at all; it used to poll a count of its own.
  const {
    unreadNotifications: unreadCount,
    setUnreadNotifications,
    refresh: refreshBadges,
  } = useBadges();

  // Full page: the rows the dropdown renders, plus the badge count.
  const load = () => {
    return fetch("/api/notifications?page=1")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setNotifications((body.data ?? []).slice(0, 8));
        });
        setUnreadNotifications(body.unreadCount ?? 0);
      })
      .catch(() => {});
  };

  // Poll every 30s while the dropdown is open, until real-time delivery lands
  // (see CLAUDE.md). Paused while the tab is hidden. Turning `enabled` on
  // fetches immediately on its own — see usePolling's docstring — which is
  // what puts the rows on screen the moment the dropdown opens.
  usePolling(load, { intervalMs: 30_000, enabled: isOpen });

  // Opening needs no explicit load() (the poller above fires as it is
  // enabled; a second call here used to send a redundant
  // `/api/notifications?page=1` on every open). Closing asks for the badges
  // again, which is what the count-only fetch used to do at this moment.
  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) refreshBadges();
  };

  const onClickNotification = async (notification: Notification) => {
    setIsOpen(false);
    if (!notification.readAt) {
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
      setUnreadNotifications((c) => c - 1);
    }
    router.push(notificationHref(notification));
  };

  const onMarkAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setUnreadNotifications(0);
    startTransition(() => {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })),
      );
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-5" />
            {unreadCount > 0 ? (
              <span className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-danger text-sm font-bold text-text-on-brand">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
            <span className="sr-only">{t("title")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-body-md font-semibold! text-text-primary">
            {t("title")}
          </span>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-body-sm font-semibold! text-brand-primary"
            >
              {t("markAllRead")}
            </button>
          ) : null}
        </div>

        <div className="max-h-[360px] overflow-x-hidden overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-5 text-center text-body-sm text-text-secondary">
              {t("emptyState")}
            </p>
          ) : (
            notifications.map((notification) => {
              const Icon = ICONS[notification.type] ?? Bell;
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => onClickNotification(notification)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-border-subtle px-4 py-3 text-left last:border-b-0 hover:bg-bg-sunken",
                    !notification.readAt && "bg-success-bg/40",
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-sunken">
                    <Icon className="size-4 text-text-secondary" />
                  </div>
                  {/* Titles carry user text (request and product names), so an
                      unbroken word must wrap here, not widen the list. */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 [overflow-wrap:anywhere]">
                    <span className="text-body-sm font-semibold! text-text-primary">
                      {notification.title}
                    </span>
                    <span className="line-clamp-2 text-body-sm text-text-secondary">
                      {notification.message}
                    </span>
                    <span className="text-body-sm text-text-tertiary">
                      {relativeTime(notification.createdAt, {
                        justNow: t("justNow"),
                        minutesAgo: (n) => t("minutesAgo", { count: n }),
                        hoursAgo: (n) => t("hoursAgo", { count: n }),
                        daysAgo: (n) => t("daysAgo", { count: n }),
                      })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <Link
          href="/dashboard/notifications"
          onClick={() => setIsOpen(false)}
          className="block border-t border-border-subtle px-4 py-3 text-center text-body-sm font-semibold! text-brand-primary"
        >
          {t("viewAll")}
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
