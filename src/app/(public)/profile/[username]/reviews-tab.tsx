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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

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
  booking?: { service: { name: string } | null } | null;
}

const INITIAL_REVIEWS = 3;

export function ReviewsTab({
  providerId,
  providerName,
  reviews,
  stats,
}: {
  providerId: string;
  providerName: string;
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
  const [showAll, setShowAll] = useState(false);

  // From the true DB-side aggregate (stats), not derived from `reviews` —
  // that list is capped (see getProfileReviews), so computing these here
  // would silently go wrong for a provider with more reviews than the
  // display cap fetches.
  const average = stats.avgRating.toFixed(1);
  const averageVi = average.replace(".", ",");
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
      <div className="flex flex-col gap-5 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-5 sm:flex-row sm:items-center sm:gap-10">
        <div className="flex flex-col gap-1">
          <span className="text-display-lg text-text-primary tabular-nums">
            {averageVi}
          </span>
          <StarRating rating={average} reviews={stats.count} />
          <span className="max-w-[220px] text-meta text-text-tertiary">
            {t("onlyCompleted")}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {breakdown.map((b) => (
            <div key={b.stars} className="flex items-center gap-3">
              <span className="w-7 text-meta text-text-tertiary">
                {b.stars}★
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-sunken">
                <div
                  className="h-full rounded-full bg-gold-400"
                  style={{ width: `${b.percent}%` }}
                />
              </div>
              <span className="w-8 text-right text-meta text-text-tertiary tabular-nums">
                {b.count}
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

      {/* Each review is a print taped to the wall (owner, 16/11/2026):
          cream paper in both themes, the customer's words as the caption.
          Alternate prints lean opposite ways and straighten on hover. */}
      <div className="grid gap-x-6 gap-y-8 pt-3 sm:grid-cols-2">
        {(showAll ? filtered : filtered.slice(0, INITIAL_REVIEWS)).map(
          (review, index) => {
            const name =
              review.reviewer.firstName ??
              review.reviewer.name ??
              t("anonymous");
            return (
              <article
                key={review.id}
                className={cn(
                  "relative flex flex-col gap-3 rounded-[4px] bg-[#f6f1e7] p-5 pt-7 text-[#2a251c] shadow-[var(--shadow-md)] transition-transform duration-[var(--fg-dur-260)] ease-fg-out hover:rotate-0 motion-reduce:rotate-0 motion-reduce:transition-none",
                  index % 2 === 0 ? "-rotate-1" : "rotate-1",
                )}
              >
                <span
                  aria-hidden
                  className="absolute -top-2.5 left-1/2 h-5 w-24 -translate-x-1/2 -rotate-2 bg-gold-300/80 shadow-[0_1px_2px_rgb(0_0_0_/_0.15)]"
                />
                <StarRating rating={review.rating} />
                {review.content ? (
                  <p className="font-display text-[1.125rem] leading-[1.45] [overflow-wrap:anywhere] text-[#2a251c] italic">
                    “{review.content}”
                  </p>
                ) : null}
                <div className="mt-auto flex items-center gap-2.5">
                  <Avatar className="shrink-0">
                    {review.reviewer.avatar ? (
                      <AvatarImage src={review.reviewer.avatar} alt="" />
                    ) : null}
                    <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-body-md font-semibold text-[#2a251c]">
                      {name}
                    </span>
                    <span className="truncate font-mono text-meta text-[#756c5b]">
                      {[
                        review.booking?.service?.name,
                        formatDate(review.createdAt),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </div>
                {review.response ? (
                  <div className="rounded-[4px] border-l-2 border-[#8a5a12] bg-[#ebe4d4] px-3.5 py-2.5">
                    <p className="text-meta text-[#756c5b]">
                      {t("responseFrom", { name: providerName })}
                    </p>
                    <p className="text-body-sm text-[#3b352a]">
                      {review.response}
                    </p>
                  </div>
                ) : null}

                {(isOwner && !review.response) || !isOwner ? (
                  <div className="flex gap-3">
                    {isOwner && !review.response ? (
                      <button
                        type="button"
                        onClick={() => setRespondTarget(review)}
                        className="focus-ring rounded-[4px] text-body-sm font-semibold! text-[#0f4a3c]"
                      >
                        {t("respond")}
                      </button>
                    ) : null}
                    {!isOwner ? (
                      <button
                        type="button"
                        onClick={() => setReportTarget(review.id)}
                        className="focus-ring rounded-[4px] text-body-sm text-[#756c5b]"
                      >
                        {t("report")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          },
        )}
      </div>

      {!showAll && filtered.length > INITIAL_REVIEWS ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setShowAll(true)}
        >
          {t("seeAll", { count: stats.count })}
        </Button>
      ) : null}

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
