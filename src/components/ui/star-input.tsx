"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  showLabel?: boolean;
}

export function StarInput({
  value,
  onChange,
  size = 32,
  showLabel = false,
}: StarInputProps) {
  const t = useTranslations("uiKit.starInput");
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  const LABELS: Record<number, string> = {
    1: t("labels.poor"),
    2: t("labels.fair"),
    3: t("labels.good"),
    4: t("labels.veryGood"),
    5: t("labels.excellent"),
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(star)}
            aria-label={t("starAriaLabel", { count: star })}
            className="cursor-pointer"
          >
            <Star
              size={size}
              className={cn(
                star <= active
                  ? "fill-gold-400 text-gold-400"
                  : "fill-none text-neutral-300",
              )}
            />
          </button>
        ))}
      </div>
      {showLabel && active > 0 ? (
        <span className="text-body-sm font-semibold text-text-secondary">
          {LABELS[active]}
        </span>
      ) : null}
    </div>
  );
}
