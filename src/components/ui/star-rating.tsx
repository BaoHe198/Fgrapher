import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: string | number;
  reviews: number;
  size?: number;
  className?: string;
}

function StarRating({
  rating,
  reviews,
  size = 16,
  className,
}: StarRatingProps) {
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
