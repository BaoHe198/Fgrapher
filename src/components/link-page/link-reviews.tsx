"use client";

import { MessageSquareQuote, Sparkles, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface LinkReview {
  id: string;
  rating: number;
  content: string | null;
  response: string | null;
  createdAt: string;
  reviewerName: string | null;
  reviewerAvatar: string | null;
}

interface LinkReviewsProps {
  reviews: LinkReview[];
  rating: {
    average: number;
    count: number;
    breakdown: { stars: number; count: number; percent: number }[];
  };
  callName: string;
  joinedAt: string;
  /** Where every review lives: the full profile's review section. */
  allHref: string;
}

const monthYear = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span aria-hidden className={cn("flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3.5",
            n <= Math.round(value)
              ? "fill-gold-400 text-gold-400"
              : "text-border-strong",
          )}
        />
      ))}
    </span>
  );
}

// Step 1 of the link page: what other customers say. Only reviews written
// after a completed booking exist on Fgrapher, so the count is a count of
// real shoots - the summary says that, because it is the reason to trust a
// small number over a page full of screenshots.
export function LinkReviews({
  reviews,
  rating,
  callName,
  joinedAt,
  allHref,
}: LinkReviewsProps) {
  const t = useTranslations("linkPage.reviews");

  if (rating.count === 0) {
    // A new profile says what it is instead of showing "0 đánh giá".
    return (
      <div className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-dashed border-border-strong bg-bg-surface p-5">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-meta font-semibold! text-gold-800 dark:bg-gold-900/40 dark:text-gold-200">
          <Sparkles aria-hidden className="size-3.5" />
          {t("newBadge", { date: monthYear(joinedAt) })}
        </span>
        <p className="text-body-md text-text-primary">
          {t("emptyTitle", { name: callName })}
        </p>
        <p className="text-body-sm text-text-secondary">{t("emptyBody")}</p>
      </div>
    );
  }

  const average = rating.average.toFixed(1).replace(".", ",");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
        <div className="flex flex-col gap-1">
          <span className="font-display text-[3.5rem] leading-none font-semibold tracking-[-0.03em] text-text-primary tabular-nums">
            {average}
          </span>
          <Stars value={rating.average} />
          <span className="text-meta text-text-secondary">
            {t("countLine", { count: rating.count })}
          </span>
        </div>
        <ul className="flex flex-col gap-1.5" aria-label={t("breakdownLabel")}>
          {rating.breakdown
            .slice()
            .sort((a, b) => b.stars - a.stars)
            .map((row) => (
              <li
                key={row.stars}
                className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-3 text-meta text-text-secondary"
              >
                <span className="inline-flex items-center gap-1 tabular-nums">
                  {row.stars}
                  <Star aria-hidden className="size-3 fill-current" />
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-bg-sunken">
                  {/* A data-driven width has no Tailwind class; the full
                      profile's breakdown bars do the same. */}
                  <span
                    className="block h-full rounded-full bg-gold-400"
                    style={{ width: `${row.percent}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">{row.count}</span>
              </li>
            ))}
        </ul>
      </div>

      <ul className="flex flex-col gap-4">
        {reviews.map((review) => {
          const name = review.reviewerName ?? t("anonymous");
          return (
            <li
              key={review.id}
              className="flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  {review.reviewerAvatar ? (
                    <AvatarImage src={review.reviewerAvatar} alt="" />
                  ) : null}
                  <AvatarFallback>
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-sm font-semibold! text-text-primary">
                    {name}
                  </span>
                  <span className="text-meta text-text-tertiary">
                    {t("shotOn", { date: formatDate(review.createdAt) })}
                  </span>
                </div>
                <Stars value={review.rating} />
                <span className="sr-only">
                  {t("starsLabel", { count: review.rating })}
                </span>
              </div>
              {review.content ? (
                <p className="text-body-md whitespace-pre-line [overflow-wrap:anywhere] text-text-primary">
                  {review.content}
                </p>
              ) : null}
              {review.response ? (
                <div className="flex gap-2.5 rounded-[var(--fg-radius-md)] bg-bg-sunken px-3.5 py-3">
                  <MessageSquareQuote
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-text-tertiary"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-meta font-semibold! text-text-secondary">
                      {t("responseFrom", { name: callName })}
                    </span>
                    <p className="text-body-sm whitespace-pre-line [overflow-wrap:anywhere] text-text-secondary">
                      {review.response}
                    </p>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {rating.count > reviews.length ? (
        <Link
          href={allHref}
          className="focus-ring w-fit text-body-sm font-semibold! text-text-primary underline decoration-gold-400 underline-offset-4 hover:decoration-2"
        >
          {t("seeAll", { count: rating.count })}
        </Link>
      ) : null}
    </div>
  );
}
