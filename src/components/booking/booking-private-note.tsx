"use client";

import { Loader2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

interface BookingPrivateNoteProps {
  bookingId: string;
}

/**
 * The viewer's own note on this booking — the same one the work calendar
 * shows and edits (BookingNote). A provider who wrote "mang ống 85mm" in
 * the calendar and opened the booking to check found nothing here.
 */
export function BookingPrivateNote({ bookingId }: BookingPrivateNoteProps) {
  const t = useTranslations("dashboardCore.calendar.v2");
  const tSheet = useTranslations("dashboardCore.calendar.v2.itemSheet");
  const [saved, setSaved] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/${bookingId}/note`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.message);
        return (body.data?.note ?? "") as string;
      })
      .then((value) => {
        if (cancelled) return;
        startTransition(() => {
          setSaved(value);
          setNote(value);
          setStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) startTransition(() => setStatus("error"));
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/bookings/${bookingId}/note`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }).catch(() => null);
    setSaving(false);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      toast.add({
        title: body?.message ?? t("entryForm.genericError"),
        type: "error",
      });
      return;
    }
    setSaved(note.trim());
    toast.add({ title: tSheet("noteSaved"), type: "success" });
  };

  return (
    <Card className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-body-sm font-semibold! text-text-primary">
        <Lock aria-hidden className="size-4 text-text-tertiary" />
        {t("privateNote")}
      </span>
      {status === "loading" ? (
        <Skeleton className="h-20 w-full" />
      ) : status === "error" ? (
        <p role="alert" className="text-body-sm text-danger">
          {t("loadFailed")}
        </p>
      ) : (
        <>
          <Textarea
            aria-label={t("privateNote")}
            hint={tSheet("noteHint")}
            rows={3}
            maxLength={2000}
            value={note}
            placeholder={tSheet("notePlaceholder")}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            variant="secondary"
            className="self-start"
            disabled={saving || note.trim() === (saved ?? "")}
            onClick={save}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {tSheet("saveNote")}
          </Button>
        </>
      )}
    </Card>
  );
}
