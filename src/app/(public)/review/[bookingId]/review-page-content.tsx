"use client";

import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ReviewModal } from "@/components/modals/review-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const REASON_MESSAGE: Record<string, string> = {
  not_found: "We couldn't find this booking, or it doesn't belong to you.",
  not_completed: "This booking hasn't been marked complete yet.",
  already_reviewed: "You've already reviewed this booking.",
  window_expired: "The 30-day review window for this booking has closed.",
};

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
  const [open, setOpen] = useState(eligible);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <Card className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="size-14 text-success" />
          <h1 className="text-heading-xl text-text-primary">Thanks for your review!</h1>
          <p className="text-body-md text-text-secondary">
            Your feedback helps other clients find the right artist.
          </p>
          {providerUsername ? (
            <Button variant="accent" nativeButton={false} render={<Link href={`/profile/${providerUsername}`} />}>
              View profile
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
          <p className="text-body-lg font-semibold text-text-primary">Can&apos;t leave a review</p>
          <p className="text-body-md text-text-secondary">
            {reason ? REASON_MESSAGE[reason] : "This review link is no longer valid."}
          </p>
          <Button variant="secondary" nativeButton={false} render={<Link href="/dashboard/bookings" />}>
            Back to bookings
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
