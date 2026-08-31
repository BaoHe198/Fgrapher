"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ReportModal } from "@/components/modals/report-modal";
import { RespondReviewModal } from "@/components/modals/respond-review-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NativeSelect } from "@/components/ui/native-select";
import { StarRating } from "@/components/ui/star-rating";
import { Tag } from "@/components/ui/tag";
import { formatMonthYear } from "@/lib/format";

interface ReviewItem {
  id: string;
  rating: number;
  content: string | null;
  response: string | null;
  createdAt: string;
  reviewer: {
    name: string | null;
    firstName: string | null;
    avatar: string | null;
  };
}

export function ReviewsTab({
  providerId,
  reviews,
  stats,
}: {
  providerId: string;
  reviews: ReviewItem[];
  stats: {
    avgRating: number;
    count: number;
    breakdown: { stars: number; count: number; percent: number }[];
  };
}) {
  const t = useTranslations("publicPages.profile.reviewsTab");
  const SORT_OPTIONS = [
    { value: "newest", label: t("sortNewest") },
    { value: "highest", label: t("sortHighest") },
    { value: "lowest", label: t("sortLowest") },
  ];
  const { data: session } = useSession();
  const router = useRouter();
  const isOwner = session?.user?.id === providerId;
  const [sort, setSort] = useState("newest");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [respondTarget, setRespondTarget] = useState<ReviewItem | null>(null);
  const [reportTarget, setReportTarget] = useState<string | null>(null);

  // From the true DB-side aggregate (stats), not derived from `reviews` —
  // that list is capped (see getProfileReviews), so computing these here
  // would silently go wrong for a provider with more reviews than the
  // display cap fetches.
  const average = stats.avgRating.toFixed(1);
  const breakdown = stats.breakdown;

  const filtered = useMemo(() => {
    let list = reviews;
    if (ratingFilter) list = list.filter((r) => r.rating === ratingFilter);
    const copy = [...list];
    if (sort === "highest") return copy.sort((a, b) => b.rating - a.rating);
    if (sort === "lowest") return copy.sort((a, b) => a.rating - b.rating);
    return copy.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [reviews, sort, ratingFilter]);

  if (stats.count === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-[var(--fg-radius-md)] bg-surface-card p-5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-display-lg text-text-primary">{average}</span>
          <StarRating rating={average} reviews={stats.count} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {breakdown.map((b) => (
            <div key={b.stars} className="flex items-center gap-2">
              <span className="w-8 text-body-sm text-text-tertiary">
                {b.stars}★
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-gold-400"
                  style={{ width: `${b.percent}%` }}
                />
              </div>
              <span className="w-8 text-right text-body-sm text-text-tertiary">
                {b.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Tag
            selected={ratingFilter === null}
            onClick={() => setRatingFilter(null)}
          >
            {t("all")}
          </Tag>
          {[5, 4, 3, 2, 1].map((stars) => (
            <Tag
              key={stars}
              selected={ratingFilter === stars}
              onClick={() =>
                setRatingFilter(ratingFilter === stars ? null : stars)
              }
            >
              {stars}★
            </Tag>
          ))}
        </div>
        <NativeSelect
          options={SORT_OPTIONS}
          value={sort}
          onChange={setSort}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-[18px]">
        {filtered.map((review) => {
          const name =
            review.reviewer.firstName ?? review.reviewer.name ?? t("anonymous");
          return (
            <div key={review.id} className="flex gap-3">
              <Avatar size="lg" className="shrink-0">
                {review.reviewer.avatar ? (
                  <AvatarImage src={review.reviewer.avatar} alt="" />
                ) : null}
                <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-heading-sm text-text-primary">
                  {name}
                </span>
                <div className="flex items-center gap-2">
                  <StarRating
                    rating={review.rating}
                    reviews={0}
                    className="[&>span:last-child]:hidden"
                  />
                  <span className="text-body-sm text-text-tertiary">
                    {formatMonthYear(review.createdAt)}
                  </span>
                </div>
                {review.content ? (
                  <p className="text-body-md text-text-secondary">
                    {review.content}
                  </p>
                ) : null}
                {review.response ? (
                  <div className="mt-2 border-l-2 border-brand-primary pl-3">
                    <p className="text-body-sm text-text-secondary">
                      {review.response}
                    </p>
                  </div>
                ) : null}

                <div className="mt-1.5 flex gap-3">
                  {isOwner && !review.response ? (
                    <button
                      type="button"
                      onClick={() => setRespondTarget(review)}
                      className="text-body-sm font-semibold! text-brand-primary"
                    >
                      {t("respond")}
                    </button>
                  ) : null}
                  {!isOwner ? (
                    <button
                      type="button"
                      onClick={() => setReportTarget(review.id)}
                      className="text-body-sm text-text-tertiary"
                    >
                      {t("report")}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {respondTarget ? (
        <RespondReviewModal
          open={Boolean(respondTarget)}
          onOpenChange={(open) => !open && setRespondTarget(null)}
          reviewId={respondTarget.id}
          reviewerName={
            respondTarget.reviewer.firstName ??
            respondTarget.reviewer.name ??
            t("anonymous")
          }
          rating={respondTarget.rating}
          content={respondTarget.content}
          onSuccess={() => router.refresh()}
        />
      ) : null}

      {reportTarget ? (
        <ReportModal
          open={Boolean(reportTarget)}
          onOpenChange={(open) => !open && setReportTarget(null)}
          targetType="review"
          targetId={reportTarget}
        />
      ) : null}
    </div>
  );
}
