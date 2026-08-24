"use client";

import { useTranslations } from "next-intl";
import { Fragment, useState } from "react";

import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_KEYS,
  type NotificationPreferences,
} from "@/lib/validations/user";

const DEFAULT_PREFERENCES: NotificationPreferences = Object.fromEntries(
  NOTIFICATION_KEYS.map((key) => [key, { email: true, inApp: true }]),
) as NotificationPreferences;

const GROUPS: {
  titleKey: "bookings" | "messages" | "social" | "marketing";
  keys: (typeof NOTIFICATION_KEYS)[number][];
}[] = [
  {
    titleKey: "bookings",
    keys: [
      "bookingRequest",
      "bookingConfirmed",
      "bookingCancelled",
      "bookingReminder",
    ],
  },
  { titleKey: "messages", keys: ["newMessage"] },
  { titleKey: "social", keys: ["newFollower", "newReview"] },
  { titleKey: "marketing", keys: ["productUpdates", "tips"] },
];

export function NotificationsSettings({
  initialPreferences,
}: {
  initialPreferences: NotificationPreferences | null;
}) {
  const t = useTranslations("dashboardSettings.notifications");
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    initialPreferences ?? DEFAULT_PREFERENCES,
  );

  const toggle = async (
    key: (typeof NOTIFICATION_KEYS)[number],
    channel: "email" | "inApp",
    value: boolean,
  ) => {
    const next = {
      ...preferences,
      [key]: { ...preferences[key], [channel]: value },
    };
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
        <div key={group.titleKey} className="flex flex-col gap-2">
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            {t(`groups.${group.titleKey}`)}
          </span>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-3">
            <span />
            <span className="text-body-sm text-text-tertiary">
              {t("email")}
            </span>
            <span className="text-body-sm text-text-tertiary">
              {t("inApp")}
            </span>
            {group.keys.map((key) => (
              <Fragment key={key}>
                <span className="text-body-md text-text-primary">
                  {t(`labels.${key}`)}
                </span>
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
