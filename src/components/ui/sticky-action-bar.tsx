import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// Phone-only bar pinned to the bottom (system audit 09/2026 §05). Profile
// and booking each built their own - one with a shadow, one without. The
// rule now: a hairline top border only (shadows vanish on a dark page),
// bg-surface, and room for the home indicator. The page must leave
// matching space at its foot (pb-24 lg:pb-0) so the bar never covers
// content.

interface StickyActionBarProps {
  /** Left side, e.g. "Từ 2.000.000₫". */
  title?: React.ReactNode;
  /** Trust line under it, e.g. "Phản hồi trong 2 giờ · 312 buổi đã chụp". */
  subtitle?: React.ReactNode;
  /** The primary control: a Button, or a Link rendered as one. */
  primary: React.ReactNode;
  /** Optional second control (icon button, "Nhắn tin"). */
  secondary?: React.ReactNode;
  /** Shows a spinner in place of the title while a submit runs. */
  busy?: boolean;
  /** Breakpoint from which the bar hides; defaults to lg. */
  hideFrom?: "md" | "lg";
  className?: string;
}

function StickyActionBar({
  title,
  subtitle,
  primary,
  secondary,
  busy = false,
  hideFrom = "lg",
  className,
}: StickyActionBarProps) {
  return (
    <div
      data-slot="sticky-action-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        hideFrom === "lg" ? "lg:hidden" : "md:hidden",
        className,
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {title || subtitle || busy ? (
          <div className="flex min-w-0 flex-1 flex-col">
            {busy ? (
              <Loader2
                aria-hidden
                className="size-4 animate-spin text-text-tertiary"
              />
            ) : title ? (
              <span className="truncate text-heading-sm text-text-primary">
                {title}
              </span>
            ) : null}
            {subtitle ? (
              <span className="truncate text-meta text-text-tertiary">
                {subtitle}
              </span>
            ) : null}
          </div>
        ) : null}
        {secondary}
        <div
          className={cn(!title && !subtitle && !busy && "flex-1 [&>*]:w-full")}
        >
          {primary}
        </div>
      </div>
    </div>
  );
}

export { StickyActionBar };
