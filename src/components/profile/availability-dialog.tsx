"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { AvailabilitySettings } from "@/app/(dashboard)/dashboard/settings/profile/availability-settings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Thin wrapper around the dashboard's own AvailabilitySettings (zero
// props, fully self-contained — fetches GET /api/availability itself,
// saves via PUT /api/availability + POST/DELETE /api/blocked-dates) so
// the owner can edit their weekly schedule/blocked dates right from the
// booking sidebar's own-profile card instead of navigating away.
export function AvailabilityDialog({
  open,
  onOpenChange,
}: AvailabilityDialogProps) {
  const t = useTranslations("publicPages.profile.bookingSidebar");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("availabilityDialogTitle")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <AvailabilitySettings />
        </div>
        <Link
          href="/dashboard/calendar"
          className="text-body-sm font-semibold! text-text-link hover:underline"
        >
          {t("fullCalendarLink")}
        </Link>
      </DialogContent>
    </Dialog>
  );
}
