import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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
