"use client";

import { AlertTriangle, Loader2, Lock, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { AgendaItem } from "@/lib/calendar/agenda";

import { ResponsiveSheet } from "./responsive-sheet";

interface EntrySheetProps {
  /** The entry being edited, or null to add a new one. */
  entry: AgendaItem | null;
  /** The day a new entry starts on. */
  defaultDate: string;
  /** Every job already loaded, to warn about an overlap before saving. */
  existing: AgendaItem[];
  onOpenChange: (open: boolean) => void;
  onSaved: (dateKey: string) => void;
}

function minutes(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Add or change one of the provider's own jobs. Mounted only while open
 * (the parent keys it by entry), so its fields start from the entry or the
 * chosen day every time with no effect to reset them.
 */
export function EntrySheet({
  entry,
  defaultDate,
  existing,
  onOpenChange,
  onSaved,
}: EntrySheetProps) {
  const t = useTranslations("dashboardCore.calendar.v2.entryForm");

  const [title, setTitle] = useState(entry?.title ?? "");
  const [date, setDate] = useState(entry?.dateKey ?? defaultDate);
  const [startTime, setStartTime] = useState(entry?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(entry?.endTime ?? "11:00");
  const [address, setAddress] = useState(entry?.address ?? "");
  const [customerName, setCustomerName] = useState(entry?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(
    entry?.customerPhone ?? "",
  );
  const [price, setPrice] = useState(
    entry?.price ? String(Math.round(entry.price)) : "",
  );
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const timesValid = Boolean(startTime && endTime && endTime > startTime);
  const overlaps =
    timesValid &&
    existing.some(
      (other) =>
        other.kind !== "BLOCK" &&
        !(other.kind === "ENTRY" && other.id === entry?.id) &&
        other.dateKey === date &&
        other.startTime &&
        other.endTime &&
        minutes(startTime) < minutes(other.endTime) &&
        minutes(other.startTime) < minutes(endTime),
    );

  const save = async () => {
    setError(null);
    if (!title.trim()) {
      setTitleError(t("titleRequired"));
      return;
    }
    if (!timesValid) {
      setError(t("endBeforeStart"));
      return;
    }
    setBusy("save");
    const res = await fetch(
      entry ? `/api/calendar/entries/${entry.id}` : "/api/calendar/entries",
      {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date,
          startTime,
          endTime,
          locationAddress: address,
          customerName,
          customerPhone,
          price: price ? Number(price) : null,
          notes,
        }),
      },
    ).catch(() => null);
    setBusy(null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(body?.message ?? t("genericError"));
      return;
    }
    toast.add({ title: t("saved"), type: "success" });
    onSaved(date);
  };

  const remove = async () => {
    if (!entry) return;
    setBusy("delete");
    const res = await fetch(`/api/calendar/entries/${entry.id}`, {
      method: "DELETE",
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.message ?? t("genericError"));
      return;
    }
    toast.add({ title: t("deleted"), type: "success" });
    onSaved(entry.dateKey);
  };

  return (
    <ResponsiveSheet
      open
      onOpenChange={onOpenChange}
      title={entry ? t("editTitle") : t("createTitle")}
      footer={
        confirmingDelete ? (
          <div className="flex flex-col gap-2">
            <p className="text-body-sm text-text-primary">
              {t("deleteConfirm")}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => setConfirmingDelete(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={busy !== null}
                onClick={remove}
              >
                {busy === "delete" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {t("confirmDelete")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            {entry ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("delete")}
                title={t("delete")}
                disabled={busy !== null}
                onClick={() => setConfirmingDelete(true)}
                className="shrink-0 text-danger"
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy !== null}
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              disabled={busy !== null}
              onClick={save}
            >
              {busy === "save" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {t("save")}
            </Button>
          </div>
        )
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error ? (
          <p
            role="alert"
            className="rounded-[var(--fg-radius-md)] bg-danger-bg p-3 text-body-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        <Input
          label={t("title")}
          requiredMark
          value={title}
          maxLength={120}
          placeholder={t("titlePlaceholder")}
          error={titleError ?? undefined}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError(null);
          }}
        />

        <DateField label={t("date")} value={date} onChange={setDate} />

        <div className="grid grid-cols-2 gap-3">
          <Input
            type="time"
            label={t("start")}
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
          <Input
            type="time"
            label={t("end")}
            value={endTime}
            error={
              startTime && endTime && !timesValid
                ? t("endBeforeStart")
                : undefined
            }
            onChange={(event) => setEndTime(event.target.value)}
          />
        </div>
        {overlaps ? (
          <p className="flex items-start gap-2 text-body-sm text-warning">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("clashWarning")}
          </p>
        ) : null}

        <Input
          label={t("address")}
          value={address}
          maxLength={300}
          placeholder={t("addressPlaceholder")}
          autoComplete="off"
          onChange={(event) => setAddress(event.target.value)}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={t("customerName")}
            value={customerName}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => setCustomerName(event.target.value)}
          />
          <Input
            type="tel"
            inputMode="tel"
            label={t("customerPhone")}
            value={customerPhone}
            maxLength={20}
            autoComplete="off"
            onChange={(event) => setCustomerPhone(event.target.value)}
          />
        </div>
        <p className="-mt-2 text-body-sm text-text-tertiary">
          {t("thirdParty")}
        </p>

        <CurrencyInput label={t("price")} value={price} onChange={setPrice} />

        <Textarea
          label={t("notes")}
          rows={3}
          maxLength={2000}
          value={notes}
          placeholder={t("notesPlaceholder")}
          onChange={(event) => setNotes(event.target.value)}
        />

        <p className="flex items-start gap-2 rounded-[var(--fg-radius-md)] bg-bg-sunken p-3 text-body-sm text-text-secondary">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("privacy")}
        </p>
        {/* Lets the keyboard's "Go" submit the form; the visible buttons
            live in the sheet's pinned footer, outside this element. */}
        <button type="submit" hidden />
      </form>
    </ResponsiveSheet>
  );
}
