"use client";

import type { BookingStatus } from "@prisma/client";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateLong } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";

export interface BookingListItemData {
  id: string;
  status: BookingStatus;
  date: string | Date;
  startTime: string;
  endTime: string | null;
  totalPrice: number | null;
  currency: string;
  locationType: string | null;
  locationAddress: string | null;
  expiresAt: string | Date | null;
  serviceName: string | null;
  party: { name: string; avatar: string | null };
  reviewed: boolean;
}

interface BookingListItemProps {
  booking: BookingListItemData;
  /** The viewer is the provider (acts on requests) rather than the customer. */
  asProvider: boolean;
  /** Read once per mount by the list, so every card agrees on "now". */
  now: number;
  /** Buttons for this booking (accept, message, cancel…), right-aligned. */
  actions: React.ReactNode;
  /** A shoot whose day passed while still CONFIRMED (provider view). */
  overdue?: boolean;
}

const VN_TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// One booking in "Lịch đặt" (redesign 09/2026): who, the status, the
// package and price, when and where, then the one line that matters for
// this status - the response deadline on a request, the review prompt on
// a finished shoot. Status label and colour come from BookingStatusBadge,
// the single place that maps them.
export function BookingListItem({
  booking,
  asProvider,
  now,
  actions,
  overdue = false,
}: BookingListItemProps) {
  const t = useTranslations("dashboardCore.bookings");
  const placeT = useTranslations("publicPages.booking.stepDetails");

  const dateKey =
    typeof booking.date === "string"
      ? booking.date.slice(0, 10)
      : booking.date.toISOString().slice(0, 10);
  const when = `${formatDateLong(`${dateKey}T00:00:00.000Z`)} · ${booking.startTime}${
    booking.endTime ? ` – ${booking.endTime}` : ""
  }`;
  const placeLabel: Record<string, string> = {
    PROVIDER: placeT("locationProvider"),
    CUSTOMER: placeT("locationCustomer"),
    OUTDOOR: placeT("locationOutdoor"),
  };
  const where =
    booking.locationAddress ??
    (booking.locationType ? placeLabel[booking.locationType] : null);

  const expires =
    booking.status === "PENDING" && booking.expiresAt
      ? new Date(booking.expiresAt)
      : null;
  const hoursLeft = expires
    ? Math.max(0, Math.ceil((expires.getTime() - now) / 3_600_000))
    : null;

  const reviewDue =
    !asProvider && booking.status === "COMPLETED" && !booking.reviewed;

  return (
    <article className="flex flex-col gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5 sm:flex-row sm:items-start">
      <Avatar size="lg" className="size-14 shrink-0 max-sm:hidden">
        {booking.party.avatar ? (
          <AvatarImage src={booking.party.avatar} alt="" />
        ) : null}
        <AvatarFallback>{booking.party.name[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/dashboard/bookings/${booking.id}`}
            className="focus-ring rounded-[4px] text-heading-sm text-text-primary hover:underline hover:underline-offset-4"
          >
            {booking.party.name}
          </Link>
          <BookingStatusBadge status={booking.status} />
        </div>
        {booking.serviceName || booking.totalPrice ? (
          <p className="text-body-sm font-semibold! text-text-primary">
            {[
              booking.serviceName,
              booking.totalPrice
                ? formatCurrency(booking.totalPrice, booking.currency)
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
          <dt className="text-text-tertiary">{t("card.when")}</dt>
          <dd className="text-text-primary">{when}</dd>
          {where ? (
            <>
              <dt className="text-text-tertiary">{t("card.where")}</dt>
              <dd className="break-words text-text-primary">{where}</dd>
            </>
          ) : null}
        </dl>

        {expires && hoursLeft !== null ? (
          <p className="flex items-center gap-2 text-meta text-warning">
            <span aria-hidden className="size-1.5 rounded-full bg-warning" />
            {hoursLeft > 0
              ? t(
                  asProvider
                    ? "card.respondByProvider"
                    : "card.respondByCustomer",
                  {
                    time: VN_TIME.format(expires),
                    date: formatDate(expires),
                    hours: hoursLeft,
                  },
                )
              : // Past the deadline but the hourly expiry job hasn't run yet.
                t("card.respondOverdue")}
          </p>
        ) : null}
        {overdue ? (
          <p className="flex items-center gap-2 text-meta text-warning">
            <span aria-hidden className="size-1.5 rounded-full bg-warning" />
            {t("needsCompletion")}
          </p>
        ) : null}

        {reviewDue ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-[var(--fg-radius-md)] bg-gold-50 px-4 py-3 dark:bg-gold-900/30">
            <span className="flex items-center gap-2 text-body-sm text-text-primary">
              <Star
                aria-hidden
                className="size-4 fill-gold-400 text-gold-400"
              />
              {t("card.reviewPrompt")}
            </span>
            <Button
              size="sm"
              variant="accent"
              nativeButton={false}
              render={<Link href={`/review/${booking.id}`} />}
            >
              {t("card.writeReview")}
            </Button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "flex flex-wrap gap-2 sm:w-44 sm:shrink-0 sm:flex-col sm:items-stretch",
        )}
      >
        {actions}
      </div>
    </article>
  );
}
