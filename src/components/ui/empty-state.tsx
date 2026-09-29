import * as React from "react";
import { AlertTriangleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// The two "nothing to show" blocks (system audit 09/2026 §02). There were
// six, with three different paddings; these are 24px, radius lg, and always
// carry an action. Copy rule: the title says what is empty or what failed,
// the description says the next step, and an error says which data was
// kept ("Bộ lọc của bạn vẫn được giữ.").

interface StateBlockProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** A Button or Link; required by the pattern, optional for rare cases. */
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: StateBlockProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-[var(--fg-radius-lg)] border border-dashed border-border-strong bg-bg-surface p-6 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-bg-sunken text-text-tertiary [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-heading-sm text-text-primary">{title}</p>
        {description ? (
          <p className="text-body-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {primaryAction || secondaryAction ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

interface ErrorStateProps extends StateBlockProps {
  /** What survived the failure, e.g. "Bộ lọc của bạn vẫn được giữ." */
  kept?: React.ReactNode;
}

function ErrorState({
  title,
  description,
  kept,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-[var(--fg-radius-lg)] border border-danger/30 bg-danger-bg p-6 sm:flex-row sm:items-start",
        className,
      )}
    >
      <span aria-hidden className="text-danger [&_svg]:size-5">
        {icon ?? <AlertTriangleIcon />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-heading-sm text-text-primary">{title}</p>
        {description ? (
          <p className="text-body-sm text-text-secondary">{description}</p>
        ) : null}
        {kept ? (
          <p className="text-body-sm text-text-secondary">{kept}</p>
        ) : null}
        {primaryAction || secondaryAction ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { EmptyState, ErrorState };
