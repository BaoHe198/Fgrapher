"use client";

import Link from "next/link";
import { useState } from "react";

interface ReviewReminderBannerClientProps {
  message: string;
  ctaLabel: string;
  dismissLabel: string;
  ctaHref: string;
}

export function ReviewReminderBannerClient({
  message,
  ctaLabel,
  dismissLabel,
  ctaHref,
}: ReviewReminderBannerClientProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    // Not sticky, unlike PastDueBanner right above it in the layout — two
    // sticky siblings at the same top offset would overlap instead of
    // stacking when a user is both past-due and has unreviewed bookings.
    // On a phone the message takes the full width and the two actions sit
    // on one line under it; side by side they were squeezed into a
    // 45px column ("Đánh / giá / ngay").
    <div className="flex flex-col items-center justify-center gap-1.5 bg-info-bg px-4 py-2.5 text-center text-body-sm text-info sm:flex-row sm:gap-3">
      <span>{message}</span>
      <span className="flex shrink-0 items-center gap-4 whitespace-nowrap">
        <Link href={ctaHref} className="font-semibold underline">
          {ctaLabel}
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-info/70 underline"
        >
          {dismissLabel}
        </button>
      </span>
    </div>
  );
}
