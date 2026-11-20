"use client";

import {
  AlertTriangle,
  ChevronRight,
  MapPin,
  Navigation,
  Phone,
  StickyNote,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  type AgendaItem,
  mapsUrl,
  telHref,
  timeRangeLabel,
} from "@/lib/calendar/agenda";
import { cn } from "@/lib/utils";

interface AgendaCardProps {
  item: AgendaItem;
  /** Shares time with another job on the same day. */
  clashing: boolean;
  onOpen: (item: AgendaItem) => void;
}

const KIND_EDGE: Record<AgendaItem["kind"], string> = {
  BOOKING: "border-l-success",
  ENTRY: "border-l-gold-400",
  BLOCK: "border-l-border-strong",
};

/**
 * One thing on the day. Built for a phone held in one hand on the way to a
 * shoot: the time is the largest thing on it, the two actions a provider
 * needs right then — ring the client, get directions — are full-height
 * buttons on the card itself, and everything else is one tap further in.
 */
export function AgendaCard({ item, clashing, onOpen }: AgendaCardProps) {
  const t = useTranslations("dashboardCore.calendar.v2");
  const time = timeRangeLabel(item);
  const title =
    item.kind === "BLOCK" ? t("busyTitle") : item.title || t("customJob");
  const tel = item.customerPhone ? telHref(item.customerPhone) : null;
  const note = item.kind === "BOOKING" ? item.privateNote : item.notes;
  const contactHidden =
    item.kind === "BOOKING" &&
    item.status === "PENDING" &&
    !item.customerPhone &&
    !item.address;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[var(--fg-radius-lg)] border border-l-4 border-border-subtle bg-surface-card",
        KIND_EDGE[item.kind],
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="focus-ring flex w-full flex-col gap-1.5 p-4 text-left hover:bg-bg-sunken"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-heading-sm text-text-primary tabular-nums">
            {time ?? t("allDay")}
          </span>
          <Badge variant={item.kind === "ENTRY" ? "accent" : "neutral"}>
            {t(`kind.${item.kind}`)}
          </Badge>
          {item.kind === "BOOKING" &&
          item.status &&
          item.status !== "CONFIRMED" ? (
            <BookingStatusBadge status={item.status} />
          ) : null}
          <ChevronRight
            aria-hidden
            className="ml-auto size-4 shrink-0 text-text-tertiary"
          />
        </span>

        <span className="text-body-md font-semibold! break-words text-text-primary">
          {title}
        </span>

        {item.customerName ? (
          <span className="flex items-center gap-1.5 text-body-sm text-text-secondary">
            <User aria-hidden className="size-4 shrink-0 text-text-tertiary" />
            <span className="min-w-0 break-words">{item.customerName}</span>
          </span>
        ) : null}
        {item.address ? (
          <span className="flex items-start gap-1.5 text-body-sm text-text-secondary">
            <MapPin
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-text-tertiary"
            />
            <span className="line-clamp-2 min-w-0 break-words">
              {item.address}
            </span>
          </span>
        ) : null}
        {note ? (
          <span className="flex items-start gap-1.5 text-body-sm text-text-secondary">
            <StickyNote
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-text-tertiary"
            />
            <span className="line-clamp-2 min-w-0 break-words">{note}</span>
          </span>
        ) : null}
        {contactHidden ? (
          <span className="text-body-sm text-text-tertiary">
            {t("contactHidden")}
          </span>
        ) : null}
        {clashing ? (
          <span className="flex items-center gap-1.5 text-body-sm font-semibold! text-warning">
            <AlertTriangle aria-hidden className="size-4 shrink-0" />
            {t("clash")}
          </span>
        ) : null}
      </button>

      {tel || item.address ? (
        <div className="flex divide-x divide-border-subtle border-t border-border-subtle">
          {tel ? (
            <a
              href={tel}
              className="focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 text-body-sm font-semibold! text-text-primary hover:bg-bg-sunken"
            >
              <Phone aria-hidden className="size-4" />
              {t("call")}
            </a>
          ) : null}
          {item.address ? (
            <a
              href={mapsUrl(item.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 text-body-sm font-semibold! text-text-primary hover:bg-bg-sunken"
            >
              <Navigation aria-hidden className="size-4" />
              {t("directions")}
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
