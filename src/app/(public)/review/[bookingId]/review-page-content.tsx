"use client";

import { CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { ReviewModal } from "@/components/modals/review-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ReviewPageContent({
  bookingId,
  providerName,
  providerUsername,
  serviceName,
  eligible,
  reason,
}: {
  bookingId: string;
  providerName: string;
  providerUsername: string | null;
  serviceName: string | undefined;
  eligible: boolean;
  reason: string | null;
}) {
  const t = useTranslations("publicPages.review");
  const [open, setOpen] = useState(eligible);
  const [submitted, setSubmitted] = useState(false);

  const REASON_MESSAGE: Record<string, string> = {
    not_found: t("reasonNotFound"),
    not_completed: t("reasonNotCompleted"),
    already_reviewed: t("reasonAlreadyReviewed"),
    window_expired: t("reasonWindowExpired"),
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <Card className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="size-14 text-success" />
          <h1 className="text-heading-xl text-text-primary">{t("thanks")}</h1>
          <p className="text-body-md text-text-secondary">{t("thanksBody")}</p>
          {providerUsername ? (
            <Button
              variant="accent"
              nativeButton={false}
              render={<Link href={`/profile/${providerUsername}`} />}
            >
              {t("viewProfile")}
            </Button>
          ) : null}
        </Card>
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <Card className="flex flex-col items-center gap-3 py-12">
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("cantReview")}
          </p>
          <p className="text-body-md text-text-secondary">
            {reason ? REASON_MESSAGE[reason] : t("reasonInvalid")}
          </p>
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/dashboard/bookings" />}
          >
            {t("backToBookings")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <ReviewModal
        open={open}
        onOpenChange={setOpen}
        bookingId={bookingId}
        providerName={providerName}
        serviceName={serviceName}
        onSuccess={() => setSubmitted(true)}
      />
    </div>
  );
}
