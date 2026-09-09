"use client";

import { useTranslations } from "next-intl";
import { Fragment, useMemo, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { features } from "@/lib/features";
import {
  NOTIFICATION_KEYS,
  type NotificationPreferences,
} from "@/lib/validations/user";

const DEFAULT_PREFERENCES: NotificationPreferences = Object.fromEntries(
  NOTIFICATION_KEYS.map((key) => [key, { email: true, inApp: true }]),
) as NotificationPreferences;

const BASE_GROUPS: {
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
  {
    titleKey: "marketing",
    keys: features.marketplaceEnabled ? ["productUpdates", "tips"] : ["tips"],
  },
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

  const GROUPS = useMemo(
    () =>
      BASE_GROUPS.filter(
        (g) => g.titleKey !== "social" || features.socialFeedEnabled,
      ),
    [],
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
            {group.keys.map((key) => {
              // QA: 18 Switch elements here (9 notification types × 2
              // channels) had no accessible name at all — the row label
              // and "Email"/"Trong ứng dụng" column headers only convey
              // which switch is which visually, via grid position, not
              // to a screen reader. aria-label combines both per switch
              // without adding a second visible label next to the
              // existing grid text.
              const rowLabel = t(`labels.${key}`);
              return (
                <Fragment key={key}>
                  <span className="text-body-md text-text-primary">
                    {rowLabel}
                  </span>
                  <Switch
                    checked={preferences[key].email}
                    onChange={(value) => toggle(key, "email", value)}
                    aria-label={`${rowLabel} — ${t("email")}`}
                  />
                  <Switch
                    checked={preferences[key].inApp}
                    onChange={(value) => toggle(key, "inApp", value)}
                    aria-label={`${rowLabel} — ${t("inApp")}`}
                  />
                </Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
