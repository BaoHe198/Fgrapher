"use client";

import { Fragment, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { NOTIFICATION_KEYS, type NotificationPreferences } from "@/lib/validations/user";

const DEFAULT_PREFERENCES: NotificationPreferences = Object.fromEntries(
  NOTIFICATION_KEYS.map((key) => [key, { email: true, inApp: true }]),
) as NotificationPreferences;

const GROUPS: { title: string; keys: (typeof NOTIFICATION_KEYS)[number][] }[] = [
  {
    title: "Bookings",
    keys: ["bookingRequest", "bookingConfirmed", "bookingCancelled", "bookingReminder"],
  },
  { title: "Messages", keys: ["newMessage"] },
  { title: "Social", keys: ["newFollower", "newReview"] },
  { title: "Marketing", keys: ["productUpdates", "tips"] },
];

const LABELS: Record<(typeof NOTIFICATION_KEYS)[number], string> = {
  bookingRequest: "New booking request",
  bookingConfirmed: "Booking confirmed",
  bookingCancelled: "Booking cancelled",
  bookingReminder: "Upcoming booking reminder",
  newMessage: "New message",
  newFollower: "New follower",
  newReview: "New review",
  productUpdates: "Product updates",
  tips: "Tips and best practices",
};

export function NotificationsSettings({
  initialPreferences,
}: {
  initialPreferences: NotificationPreferences | null;
}) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    initialPreferences ?? DEFAULT_PREFERENCES,
  );

  const toggle = async (
    key: (typeof NOTIFICATION_KEYS)[number],
    channel: "email" | "inApp",
    value: boolean,
  ) => {
    const next = { ...preferences, [key]: { ...preferences[key], [channel]: value } };
    setPreferences(next);

    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationPreferences: next }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            {group.title}
          </span>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-3">
            <span />
            <span className="text-body-sm text-text-tertiary">Email</span>
            <span className="text-body-sm text-text-tertiary">In-app</span>
            {group.keys.map((key) => (
              <Fragment key={key}>
                <span className="text-body-md text-text-primary">{LABELS[key]}</span>
                <Switch
                  checked={preferences[key].email}
                  onChange={(value) => toggle(key, "email", value)}
                />
                <Switch
                  checked={preferences[key].inApp}
                  onChange={(value) => toggle(key, "inApp", value)}
                />
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
