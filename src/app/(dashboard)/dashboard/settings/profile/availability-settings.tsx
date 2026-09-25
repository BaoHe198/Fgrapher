"use client";

import { CalendarClock, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
// Kept for the initial-state builder below — day labels themselves are
// looked up via t(`days.${DAY_KEYS[i]}`) at render time.
const DAY_LABELS = DAY_KEYS;

interface DaySchedule {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

// All 7 days default ON — the provider decides which days to work, the
// system doesn't pre-exclude weekends on their behalf. A provider who
// never touches this screen ends up with a full 7-day schedule, not a
// silently-imposed Mon–Fri one.
const DEFAULT_SCHEDULE: DaySchedule[] = DAY_LABELS.map((_, dayOfWeek) => ({
  dayOfWeek,
  isActive: true,
  startTime: "09:00",
  endTime: "17:00",
}));

export function AvailabilitySettings() {
  const t = useTranslations("dashboardSettings.profile.availability");
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/availability")
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        startTransition(() => {
          if (body.data?.schedule?.length > 0) {
            const byDay = new Map(
              body.data.schedule.map((s: DaySchedule) => [s.dayOfWeek, s]),
            );
            setSchedule(
              DEFAULT_SCHEDULE.map((d) => {
                const existing = byDay.get(d.dayOfWeek) as
                  DaySchedule | undefined;
                return existing
                  ? { ...existing, isActive: true }
                  : { ...d, isActive: false };
              }),
            );
          }
          setBlockedDates(
            (body.data?.blockedDates ?? []).map(
              (b: { id: string; date: string; reason: string | null }) => ({
                id: b.id,
                date: b.date.slice(0, 10),
                reason: b.reason,
              }),
            ),
          );
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateDay = (dayOfWeek: number, patch: Partial<DaySchedule>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),
    );
  };

  // A working day has to end after it starts. "18:00 – 09:00" used to be
  // saved as-is and quietly left that day with no bookable time at all.
  const backwardsDays = schedule.filter(
    (day) => day.isActive && day.startTime >= day.endTime,
  );

  const save = async () => {
    setSaved(false);
    setSaveError(null);
    if (backwardsDays.length > 0) {
      setSaveError(t("endBeforeStart"));
      return;
    }
    setIsSaving(true);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule }),
    }).catch(() => null);
    setIsSaving(false);
    if (res?.ok) {
      setSaved(true);
    } else {
      const body = await res?.json().catch(() => null);
      setSaveError(body?.message ?? t("saveFailed"));
    }
  };

  const addBlockedDate = async () => {
    if (!newBlockedDate) return;
    const res = await fetch("/api/blocked-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newBlockedDate }),
    });
    const body = await res.json();
    if (res.ok) {
      setBlockedDates((prev) => [
        ...prev,
        { ...body.data, date: newBlockedDate },
      ]);
      setNewBlockedDate("");
    }
  };

  const removeBlockedDate = async (id: string) => {
    setBlockedDates((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/blocked-dates/${id}`, { method: "DELETE" });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-xl border border-info/25 bg-info-bg p-4">
        <CalendarClock className="mt-0.5 size-5 shrink-0 text-info" />
        <div className="flex flex-col gap-1">
          <p className="text-body-sm font-medium text-text-primary">
            {t("reminderTitle")}
          </p>
          <p className="text-body-sm text-text-secondary">
            {t("reminderDescription")}
          </p>
          <Link
            href="/dashboard/calendar"
            className="mt-1 w-fit text-body-sm font-medium text-info underline-offset-4 hover:underline"
          >
            {t("openCalendar")}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("weeklySchedule")}
        </span>
        {schedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className="flex flex-wrap items-center gap-3"
          >
            <Switch
              checked={day.isActive}
              onChange={(value) =>
                updateDay(day.dayOfWeek, { isActive: value })
              }
              // Same gap as notifications-settings.tsx's 18 Switches — the
              // day name is only visually adjacent, not an accessible name
              // for this specific switch.
              aria-label={t(`days.${DAY_LABELS[day.dayOfWeek]}`)}
            />
            <span className="w-24 text-body-sm text-text-primary">
              {t(`days.${DAY_LABELS[day.dayOfWeek]}`)}
            </span>
            {day.isActive ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${t(`days.${DAY_LABELS[day.dayOfWeek]}`)} — ${t("startTime")}`}
                  value={day.startTime}
                  onChange={(e) =>
                    updateDay(day.dayOfWeek, { startTime: e.target.value })
                  }
                  className="w-36"
                />
                <span className="text-text-tertiary">–</span>
                <Input
                  type="time"
                  aria-label={`${t(`days.${DAY_LABELS[day.dayOfWeek]}`)} — ${t("endTime")}`}
                  value={day.endTime}
                  onChange={(e) =>
                    updateDay(day.dayOfWeek, { endTime: e.target.value })
                  }
                  className="w-36"
                  aria-invalid={day.startTime >= day.endTime ? true : undefined}
                />
              </div>
            ) : null}
            {day.isActive && day.startTime >= day.endTime ? (
              <span className="w-full text-body-sm text-danger sm:w-auto">
                {t("endBeforeStart")}
              </span>
            ) : null}
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={isSaving}
          onClick={save}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("saveSchedule")}
        </Button>
        {saved ? (
          <span className="text-body-sm text-success" role="status">
            {t("saved")}
          </span>
        ) : saveError ? (
          <span className="text-body-sm text-danger" role="alert">
            {saveError}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("blockedDates")}
        </span>
        <div className="flex flex-wrap gap-2">
          {blockedDates.map((d) => (
            <span
              key={d.id}
              className="flex items-center gap-1.5 rounded-full bg-bg-sunken px-3 py-1.5 text-body-sm text-text-primary"
            >
              {d.date}
              <button
                type="button"
                onClick={() => removeBlockedDate(d.id)}
                aria-label={t("removeAria")}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <DateField
            aria-label={t("blockedDateLabel")}
            value={newBlockedDate}
            onChange={setNewBlockedDate}
            className="w-44"
          />
          <Button size="sm" variant="secondary" onClick={addBlockedDate}>
            {t("blockDateButton")}
          </Button>
        </div>
      </div>
    </div>
  );
}
