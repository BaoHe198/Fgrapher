"use client";

import type { BookingStatus } from "@prisma/client";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// The one place a booking status becomes a label and a colour (system audit
// 09/2026 §05). The bookings list, the booking detail page and the provider
// calendar each carried their own copy of this map.
export const BOOKING_STATUS_TONE: Record<
  BookingStatus,
  { variant: "warning" | "success" | "neutral" | "destructive"; dot: string }
> = {
  PENDING: { variant: "warning", dot: "bg-warning" },
  CONFIRMED: { variant: "success", dot: "bg-success" },
  COMPLETED: { variant: "neutral", dot: "bg-brand-primary" },
  CANCELLED: { variant: "destructive", dot: "bg-danger" },
  DECLINED: { variant: "destructive", dot: "bg-danger" },
  NO_SHOW: { variant: "destructive", dot: "bg-danger" },
  EXPIRED: { variant: "neutral", dot: "bg-text-tertiary" },
};

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

export function BookingStatusBadge({
  status,
  className,
}: BookingStatusBadgeProps) {
  const t = useTranslations("dashboardCore.bookings.status");
  const tone = BOOKING_STATUS_TONE[status];
  // A dot as well as the tint, so the status never rests on colour alone.
  return (
    <Badge variant={tone.variant} className={cn("gap-1.5", className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
      {t(status)}
    </Badge>
  );
}
