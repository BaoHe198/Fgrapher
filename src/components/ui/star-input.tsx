"use client";

import { Star } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  showLabel?: boolean;
}

export function StarInput({ value, onChange, size = 32, showLabel = false }: StarInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            className="cursor-pointer"
          >
            <Star
              size={size}
              className={cn(
                star <= active ? "fill-gold-400 text-gold-400" : "fill-none text-neutral-300",
              )}
            />
          </button>
        ))}
      </div>
      {showLabel && active > 0 ? (
        <span className="text-body-sm font-semibold text-text-secondary">{LABELS[active]}</span>
      ) : null}
    </div>
  );
}
