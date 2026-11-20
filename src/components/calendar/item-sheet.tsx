"use client";

import {
  CalendarPlus,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  User,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  type AgendaItem,
  mapsUrl,
  telHref,
  timeRangeLabel,
  vietnamToInstant,
} from "@/lib/calendar/agenda";
import { googleCalendarUrl } from "@/lib/calendar/ics";
import { formatDateLong, formatVND } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ResponsiveSheet } from "./responsive-sheet";

interface ItemSheetProps {
  item: AgendaItem;
  onOpenChange: (open: boolean) => void;
  /** Own entries only: open the form on this entry. */
  onEdit: (item: AgendaItem) => void;
  /** After the private note on a booking was saved. */
  onChanged: () => void;
}

/**
 * Everything about one job: who, where, what was asked, the provider's own
 * note, and the way to put it in the phone's calendar. Opened by tapping a
 * card. Mounted only while open and keyed by item, so the note field starts
 * from that item's note.
 */
export function ItemSheet({
  item,
  onOpenChange,
  onEdit,
  onChanged,
}: ItemSheetProps) {
  const t = useTranslations("dashboardCore.calendar.v2");
  const tSheet = useTranslations("dashboardCore.calendar.v2.itemSheet");
  const [note, setNote] = useState(item.privateNote ?? "");
  const [saving, setSaving] = useState(false);

  const title = item.title || t("customJob");
  const tel = item.customerPhone ? telHref(item.customerPhone) : null;
  const start = item.startTime
    ? vietnamToInstant(item.dateKey, item.startTime)
    : null;
  const end =
    start && item.endTime
      ? vietnamToInstant(item.dateKey, item.endTime)
      : start
        ? new Date(start.getTime() + 60 * 60 * 1000)
        : null;
  const linkClass = cn(
    buttonVariants({ variant: "secondary", size: "md" }),
    "min-h-11 flex-1",
  );

  const saveNote = async () => {
    setSaving(true);
    const res = await fetch(`/api/bookings/${item.id}/note`, {
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
    toast.add({ title: tSheet("noteSaved"), type: "success" });
    onChanged();
  };

  return (
    <ResponsiveSheet
      open
      onOpenChange={onOpenChange}
      title={title}
      description={`${formatDateLong(item.dateKey)}${
        timeRangeLabel(item) ? ` · ${timeRangeLabel(item)}` : ""
      }`}
      footer={
        item.kind === "ENTRY" ? (
          <Button variant="accent" onClick={() => onEdit(item)}>
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
        ) : item.href ? (
          <Link
            href={item.href}
            className={cn(buttonVariants({ variant: "accent" }), "min-h-11")}
          >
            <ExternalLink className="size-4" />
            {t("openBooking")}
          </Link>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.kind === "ENTRY" ? "accent" : "neutral"}>
            {t(`kind.${item.kind}`)}
          </Badge>
          {item.kind === "BOOKING" && item.status ? (
            <BookingStatusBadge status={item.status} />
          ) : null}
        </div>

        <dl className="flex flex-col gap-3 text-body-md text-text-primary">
          {item.customerName ? (
            <div className="flex items-start gap-2.5">
              <User
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-text-tertiary"
              />
              <dd className="min-w-0 break-words">
                {item.customerName}
                {item.customerPhone ? (
                  <span className="block text-body-sm text-text-secondary tabular-nums">
                    {item.customerPhone}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : item.customerPhone ? (
            <div className="flex items-start gap-2.5">
              <Phone
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-text-tertiary"
              />
              <dd className="tabular-nums">{item.customerPhone}</dd>
            </div>
          ) : null}
          {item.address ? (
            <div className="flex items-start gap-2.5">
              <MapPin
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-text-tertiary"
              />
              <dd className="min-w-0 break-words">{item.address}</dd>
            </div>
          ) : null}
          {item.price ? (
            <div className="flex items-start gap-2.5">
              <Wallet
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-text-tertiary"
              />
              <dd>
                <span className="sr-only">{t("price")}: </span>
                {formatVND(item.price)}
              </dd>
            </div>
          ) : null}
        </dl>

        {tel || item.address ? (
          <div className="flex gap-2">
            {tel ? (
              <a href={tel} className={linkClass}>
                <Phone className="size-4" />
                {t("call")}
              </a>
            ) : null}
            {item.address ? (
              <a
                href={mapsUrl(item.address)}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                <Navigation className="size-4" />
                {t("directions")}
              </a>
            ) : null}
          </div>
        ) : null}

        {item.kind === "BOOKING" &&
        item.status === "PENDING" &&
        !item.customerPhone &&
        !item.address ? (
          <p className="text-body-sm text-text-tertiary">
            {t("contactHidden")}
          </p>
        ) : null}

        {item.notes ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-body-sm font-semibold! text-text-secondary">
              {item.kind === "BOOKING"
                ? t("customerNote")
                : t("entryForm.notes")}
            </h3>
            <p className="text-body-md break-words whitespace-pre-wrap text-text-primary">
              {item.notes}
            </p>
          </section>
        ) : null}

        {item.kind === "BOOKING" ? (
          <section className="flex flex-col gap-2">
            <Textarea
              label={t("privateNote")}
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
              disabled={saving || note.trim() === (item.privateNote ?? "")}
              onClick={saveNote}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {tSheet("saveNote")}
            </Button>
          </section>
        ) : null}

        {start && end ? (
          <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <h3 className="flex items-center gap-2 text-body-sm font-semibold! text-text-primary">
              <CalendarPlus aria-hidden className="size-4" />
              {tSheet("addToPhone")}
            </h3>
            <p className="text-body-sm text-text-tertiary">
              {tSheet("addToPhoneHint")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={`/api/calendar/ics?kind=${item.kind}&id=${item.id}&date=${item.dateKey}`}
                className={linkClass}
              >
                {tSheet("otherCalendar")}
              </a>
              <a
                href={googleCalendarUrl({
                  start,
                  end,
                  summary: item.customerName
                    ? `${title} · ${item.customerName}`
                    : title,
                  location: item.address,
                  description: [
                    item.customerPhone,
                    item.notes,
                    item.privateNote,
                  ]
                    .filter(Boolean)
                    .join("\n"),
                })}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {tSheet("google")}
              </a>
            </div>
          </section>
        ) : null}
      </div>
    </ResponsiveSheet>
  );
}
