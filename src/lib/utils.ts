import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { formatDate, formatVND } from "@/lib/format";

// Fgrapher brand tokens (docs/design-reference/design-tokens.md) reuse the
// "text-" prefix for two different things: color utilities (text-brand-primary,
// text-text-primary, text-green-500, ...) and the @utility typography classes
// (text-heading-sm, text-body-md, ...). tailwind-merge's default config can't
// tell those apart from each other — it silently drops one whenever both are
// used together via cn() (confirmed: `cn("text-heading-sm", "text-text-primary")`
// only kept the last of the two). Teaching it about both groups here fixes
// that without weakening real conflict detection (two sizes, or two colors,
// still correctly resolve to the last one).
const FONT_SIZE_UTILITIES = [
  "text-display-2xl",
  "text-display-xl",
  "text-display-lg",
  "text-display-md",
  "text-heading-lg",
  "text-heading-md",
  "text-heading-sm",
  "text-body-lg",
  "text-body-md",
  "text-body-sm",
  "text-caption",
  "text-caption-upper",
];

const TEXT_COLOR_NAMES = [
  "green",
  "gold",
  "neutral",
  "brand-primary",
  "brand-accent",
  "bg-page",
  "bg-surface",
  "bg-sunken",
  "bg-inverse",
  "surface-card",
  "text-primary",
  "text-secondary",
  "text-tertiary",
  "text-on-brand",
  "text-link",
  "border-subtle",
  "border-default",
  "border-strong",
  "border-focus",
  "success",
  "success-bg",
  "warning",
  "warning-bg",
  "danger",
  "danger-bg",
  "info",
  "info-bg",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": FONT_SIZE_UTILITIES,
      "text-color": [
        (value: string) =>
          TEXT_COLOR_NAMES.some(
            (name) => value === name || value.startsWith(`${name}-`),
          ),
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// `currency` is kept only for call-site compatibility (every Prisma model
// with a currency column defaults to "VND" and CLAUDE.md scopes this MVP to
// Vietnam only, so there's never a real non-VND amount to format) — prefer
// calling formatVND directly from lib/format.ts in new code.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for signature compatibility, see comment above
export function formatCurrency(amount: number, _currency = "VND") {
  return formatVND(amount);
}

export function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) return "vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return formatDate(date);
}
