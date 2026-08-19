"use client";

import type { Notification, NotificationType } from "@prisma/client";
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarX,
  CreditCard,
  Heart,
  MessageCircle,
  Star,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ICONS: Record<NotificationType, typeof Bell> = {
  BOOKING_REQUEST: Calendar,
  BOOKING_CONFIRMED: CalendarCheck,
  BOOKING_DECLINED: CalendarX,
  BOOKING_CANCELLED: CalendarX,
  BOOKING_REMINDER: Calendar,
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

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const load = () => {
    fetch("/api/notifications?page=1")
      .then((res) => res.json())
      .then((body) => {
        startTransition(() => {
          setNotifications((body.data ?? []).slice(0, 8));
          setUnreadCount(body.unreadCount ?? 0);
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // Poll every 30s until Socket.io real-time delivery lands in Phase 8.
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) load();
  };

  const onClickNotification = async (notification: Notification) => {
    setIsOpen(false);
    if (!notification.readAt) {
      await fetch(`/api/notifications/${notification.id}/read`, { method: "PATCH" });
      startTransition(() => {
        setUnreadCount((c) => Math.max(0, c - 1));
      });
    }
    router.push(notificationHref(notification));
  };

  const onMarkAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    startTransition(() => {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })));
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-5" />
            {unreadCount > 0 ? (
              <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
            <span className="sr-only">Notifications</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-body-md font-semibold text-text-primary">Notifications</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-body-sm font-semibold text-brand-primary"
            >
              Mark all as read
            </button>
          ) : null}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-sm text-text-secondary">
              No notifications yet
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
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-body-sm font-semibold text-text-primary">
                      {notification.title}
                    </span>
                    <span className="line-clamp-2 text-body-sm text-text-secondary">
                      {notification.message}
                    </span>
                    <span className="text-body-sm text-text-tertiary">
                      {relativeTime(notification.createdAt)}
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
          className="block border-t border-border-subtle px-4 py-3 text-center text-body-sm font-semibold text-brand-primary"
        >
          View all
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
