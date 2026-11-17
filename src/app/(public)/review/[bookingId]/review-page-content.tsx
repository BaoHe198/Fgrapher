"use client";

import { CheckCircle, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FgImage } from "@/components/ui/fg-image";
import { StarInput } from "@/components/ui/star-input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

const MAX_LENGTH = 1000;
const MIN_LENGTH = 20;

// The review page as Airbnb lays it out (owner, 17/11/2026): the shoot on a
// card - a photo of the provider's work, who, which package, which day -
// beside one big question, a large row of stars and the words. It used to
// be a dialog over an empty page. The rules and the request are the same
// as the dialog's (services/reviews.ts decides eligibility; POST
// /api/reviews takes the booking, the stars and the text).
export function ReviewPageContent({
  bookingId,
  providerName,
  providerUsername,
  serviceName,
  shootDate,
  photoUrl,
  eligible,
  reason,
}: {
  bookingId: string;
  providerName: string;
  providerUsername: string | null;
  serviceName: string | undefined;
  shootDate: string;
  photoUrl: string | null;
  eligible: boolean;
  reason: string | null;
}) {
  const t = useTranslations("publicPages.review");
  const formT = useTranslations("sharedComponents.reviewModal");
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const REASON_MESSAGE: Record<string, string> = {
    not_found: t("reasonNotFound"),
    not_completed: t("reasonNotCompleted"),
    already_reviewed: t("reasonAlreadyReviewed"),
    window_expired: t("reasonWindowExpired"),
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (rating === 0) {
      setError(formT("chooseRating"));
      return;
    }
    if (content.trim().length < MIN_LENGTH) {
      setError(formT("needMoreDetail", { min: MIN_LENGTH }));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, content }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? formT("genericError"));
        return;
      }
      toast.add({ title: formT("posted"), type: "success" });
      setSubmitted(true);
    } catch {
      setError(formT("genericError"));
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="mx-auto grid w-full max-w-[1120px] items-start gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-20 lg:py-16">
      <aside className="flex flex-col gap-4 rounded-[var(--fg-radius-xl)] border border-border-subtle bg-bg-surface p-5 shadow-[var(--shadow-md)] lg:sticky lg:top-28">
        {photoUrl ? (
          <FgImage
            src={photoUrl}
            alt=""
            ratio="4/3"
            rounded="lg"
            sizes="(min-width: 1024px) 360px, 100vw"
          />
        ) : null}
        <div className="flex flex-col gap-1">
          <span className="text-heading-md text-text-primary">
            {providerName}
          </span>
          {serviceName ? (
            <span className="text-body-sm text-text-secondary">
              {serviceName}
            </span>
          ) : null}
          <span className="text-body-sm text-text-secondary">
            {t("shootOn", { date: formatDate(shootDate) })}
          </span>
        </div>
      </aside>

      <form onSubmit={onSubmit} className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="animate-rise text-display-lg text-balance text-text-primary">
            {t("heading", { name: providerName })}
          </h1>
          <p className="max-w-[56ch] text-body-md text-text-secondary">
            {t("sub")}
          </p>
        </div>

        <fieldset className="flex flex-col gap-3 border-t border-border-subtle pt-8">
          <legend className="mb-3 text-heading-sm text-text-primary">
            {t("ratingLabel")}
          </legend>
          <StarInput value={rating} onChange={setRating} size={48} showLabel />
        </fieldset>

        <div className="flex flex-col gap-2 border-t border-border-subtle pt-8">
          <label
            htmlFor="review-content"
            className="text-heading-sm text-text-primary"
          >
            {formT("shareExperience")}
          </label>
          <Textarea
            id="review-content"
            rows={7}
            maxLength={MAX_LENGTH}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={formT("contentPlaceholder")}
            className="text-body-md"
          />
          <div className="flex items-baseline justify-between gap-4 text-body-sm text-text-tertiary">
            <span>{t("publicNote", { name: providerName })}</span>
            <span className="shrink-0 tabular-nums">
              {content.length}/{MAX_LENGTH}
            </span>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-8 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/dashboard/bookings" />}
          >
            {t("backToBookings")}
          </Button>
          <Button
            type="submit"
            variant="accent"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {formT("submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
