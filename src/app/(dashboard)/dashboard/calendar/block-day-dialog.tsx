"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Radio } from "@/components/ui/radio";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

export interface BlockedDateRow {
  id: string;
  date: string;
  reason: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface BlockDayDialogProps {
  date: Date | null;
  existingBlock: BlockedDateRow | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

type Mode = "DAY" | "RANGE_TIME" | "RANGE_DATES";

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function BlockDayDialog({
  date,
  existingBlock,
  onOpenChange,
  onChanged,
}: BlockDayDialogProps) {
  const t = useTranslations("dashboardCore.calendar.blockDialog");
  const [mode, setMode] = useState<Mode>("DAY");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!date) return null;
  const dateString = dateKey(date);

  const submit = async () => {
    setBusy(true);
    const body =
      mode === "RANGE_TIME"
        ? { date: dateString, startTime, endTime, reason: reason || undefined }
        : { date: dateString, reason: reason || undefined };

    const res = await fetch(
      mode === "RANGE_DATES"
        ? "/api/blocked-dates/range"
        : "/api/blocked-dates",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "RANGE_DATES"
            ? { fromDate: dateString, toDate, reason: reason || undefined }
            : body,
        ),
      },
    );
    const result = await res.json();
    setBusy(false);

    if (!res.ok) {
      toast.add({ title: result.message ?? t("genericError"), type: "error" });
      return;
    }

    toast.add({ title: t("blockedToast"), type: "success" });
    onChanged();
    onOpenChange(false);
  };

  const unblock = async () => {
    if (!existingBlock) return;
    setBusy(true);
    await fetch(`/api/blocked-dates/${existingBlock.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    toast.add({ title: t("unblockedToast"), type: "success" });
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { date: dateString })}</DialogTitle>
        </DialogHeader>

        {existingBlock ? (
          <div className="flex flex-col gap-3">
            <p className="text-body-md text-text-secondary">
              {existingBlock.startTime && existingBlock.endTime
                ? t("currentlyBlockedRange", {
                    start: existingBlock.startTime,
                    end: existingBlock.endTime,
                  })
                : t("currentlyBlockedDay")}
            </p>
            {existingBlock.reason ? (
              <p className="text-body-sm text-text-tertiary">
                {t("reasonPrefix")} {existingBlock.reason}
              </p>
            ) : null}
            <Button
              variant="destructive"
              disabled={busy}
              onClick={unblock}
              className="self-start"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("unblockButton")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Radio
                name="block-mode"
                checked={mode === "DAY"}
                onChange={() => setMode("DAY")}
                label={t("modeDay")}
              />
              <Radio
                name="block-mode"
                checked={mode === "RANGE_TIME"}
                onChange={() => setMode("RANGE_TIME")}
                label={t("modeTimeRange")}
              />
              <Radio
                name="block-mode"
                checked={mode === "RANGE_DATES"}
                onChange={() => setMode("RANGE_DATES")}
                label={t("modeDateRange")}
              />
            </div>

            {mode === "RANGE_TIME" ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-32"
                />
                <span className="text-text-tertiary">–</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-32"
                />
              </div>
            ) : null}

            {mode === "RANGE_DATES" ? (
              <div className="flex items-center gap-2">
                <Input value={dateString} disabled className="w-40" />
                <span className="text-text-tertiary">{t("dateRangeTo")}</span>
                <Input
                  type="date"
                  value={toDate}
                  min={dateString}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>
            ) : null}

            <Textarea
              placeholder={t("reasonPlaceholder")}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-body-sm text-text-tertiary">
              {t("privateNote")}
            </p>
          </div>
        )}

        {!existingBlock ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="accent"
              disabled={busy || (mode === "RANGE_DATES" && !toDate)}
              onClick={submit}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("confirmBlock")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
