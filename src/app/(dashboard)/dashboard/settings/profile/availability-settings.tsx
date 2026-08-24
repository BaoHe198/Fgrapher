"use client";

import { Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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

const DEFAULT_SCHEDULE: DaySchedule[] = DAY_LABELS.map((_, dayOfWeek) => ({
  dayOfWeek,
  isActive: dayOfWeek >= 1 && dayOfWeek <= 5,
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

  const save = async () => {
    setIsSaving(true);
    setSaved(false);
    await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule }),
    });
    setIsSaving(false);
    setSaved(true);
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
      <div className="flex flex-col gap-2">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("weeklySchedule")}
        </span>
        {schedule.map((day) => (
          <div key={day.dayOfWeek} className="flex items-center gap-3">
            <Switch
              checked={day.isActive}
              onChange={(value) =>
                updateDay(day.dayOfWeek, { isActive: value })
              }
            />
            <span className="w-24 text-body-sm text-text-primary">
              {t(`days.${DAY_LABELS[day.dayOfWeek]}`)}
            </span>
            {day.isActive ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={day.startTime}
                  onChange={(e) =>
                    updateDay(day.dayOfWeek, { startTime: e.target.value })
                  }
                  className="w-32"
                />
                <span className="text-text-tertiary">–</span>
                <Input
                  type="time"
                  value={day.endTime}
                  onChange={(e) =>
                    updateDay(day.dayOfWeek, { endTime: e.target.value })
                  }
                  className="w-32"
                />
              </div>
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
          <span className="text-body-sm text-success">{t("saved")}</span>
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
          <Input
            type="date"
            value={newBlockedDate}
            onChange={(e) => setNewBlockedDate(e.target.value)}
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
