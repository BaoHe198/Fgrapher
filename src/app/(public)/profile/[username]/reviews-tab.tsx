"use client";

import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NativeSelect } from "@/components/ui/native-select";
import { StarRating } from "@/components/ui/star-rating";

interface ReviewItem {
  id: string;
  rating: number;
  content: string | null;
  response: string | null;
  createdAt: string;
  reviewer: { name: string | null; firstName: string | null; avatar: string | null };
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest" },
  { value: "lowest", label: "Lowest" },
];

export function ReviewsTab({ reviews }: { reviews: ReviewItem[] }) {
  const [sort, setSort] = useState("newest");

  const average =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  const breakdown = useMemo(() => {
    const counts = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((r) => r.rating === stars).length,
    }));
    return counts.map((c) => ({
      ...c,
      percent: reviews.length > 0 ? Math.round((c.count / reviews.length) * 100) : 0,
    }));
  }, [reviews]);

  const sorted = useMemo(() => {
    const copy = [...reviews];
    if (sort === "highest") return copy.sort((a, b) => b.rating - a.rating);
    if (sort === "lowest") return copy.sort((a, b) => a.rating - b.rating);
    return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews, sort]);

  if (reviews.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">No reviews yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-[var(--fg-radius-md)] bg-surface-card p-5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-display-lg text-text-primary">{average}</span>
          <StarRating rating={average} reviews={reviews.length} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {breakdown.map((b) => (
            <div key={b.stars} className="flex items-center gap-2">
              <span className="w-8 text-body-sm text-text-tertiary">{b.stars}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full rounded-full bg-gold-400" style={{ width: `${b.percent}%` }} />
              </div>
              <span className="w-8 text-right text-body-sm text-text-tertiary">{b.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <NativeSelect
          options={SORT_OPTIONS}
          value={sort}
          onChange={setSort}
          className="w-40"
        />
      </div>

      <div className="flex flex-col gap-[18px]">
        {sorted.map((review) => {
          const name = review.reviewer.firstName ?? review.reviewer.name ?? "Anonymous";
          return (
            <div key={review.id} className="flex gap-3">
              <Avatar size="lg" className="shrink-0">
                {review.reviewer.avatar ? <AvatarImage src={review.reviewer.avatar} alt="" /> : null}
                <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-heading-sm text-text-primary">{name}</span>
                <div className="flex items-center gap-2">
                  <StarRating rating={review.rating} reviews={0} className="[&>span:last-child]:hidden" />
                  <span className="text-body-sm text-text-tertiary">
                    {new Date(review.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {review.content ? (
                  <p className="text-body-md text-text-secondary">{review.content}</p>
                ) : null}
                {review.response ? (
                  <div className="mt-2 border-l-2 border-brand-primary pl-3">
                    <p className="text-body-sm text-text-secondary">{review.response}</p>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
