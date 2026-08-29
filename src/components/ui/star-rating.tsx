import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: string | number;
  reviews: number;
  size?: number;
  className?: string;
  // Prompt G5, VIỆC 5 — "Mới (0)" reads as a mistake, not a status. Opt-in
  // (rather than changing the default everywhere StarRating is used) so
  // call sites that genuinely want to show a "0" count — e.g. a provider's
  // own reviews dashboard — are unaffected.
  hideCountWhenZero?: boolean;
}

function StarRating({
  rating,
  reviews,
  size = 16,
  className,
  hideCountWhenZero = false,
}: StarRatingProps) {
  if (hideCountWhenZero && reviews === 0) {
    return (
      <div className={cn("inline-flex items-center text-body-sm", className)}>
        <span className="font-semibold text-text-primary">{rating}</span>
      </div>
    );
  }

  return (
    <div
      className={cn("inline-flex items-center gap-1 text-body-sm", className)}
    >
      <Star size={size} className="fill-gold-500 text-gold-500" />
      <span className="font-semibold text-text-primary">{rating}</span>
      <span className="text-text-secondary">({reviews})</span>
    </div>
  );
}

export { StarRating };
