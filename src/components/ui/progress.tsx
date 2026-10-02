"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

// Brand-primary on a bg-sunken track, 6px (system audit 09/2026 §05) - it
// used to fill with shadcn's --primary, near-black in light mode and
// near-white in dark.
function Progress({
  className,
  children,
  value,
  ...props
}: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-bg-sunken",
        className,
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "h-full rounded-full bg-brand-primary transition-all duration-[var(--fg-dur-260)] ease-fg-out",
        className,
      )}
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("text-body-sm font-semibold! text-text-primary", className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "ml-auto text-body-sm text-text-secondary tabular-nums",
        className,
      )}
      data-slot="progress-value"
      {...props}
    />
  );
}

interface StepProgressProps {
  steps: string[];
  /** Zero-based index of the step on screen. */
  current: number;
  /** Lets the customer jump back to a finished step. Future steps stay inert. */
  onStepClick?: (index: number) => void;
  /** Accessible name for the whole strip, e.g. "Tiến trình đặt lịch". */
  label: string;
  /** Hidden status read after each step's name. */
  statusLabels?: { done: string; current: string; todo: string };
  className?: string;
}

// The steps variant (Core MVP pass, 02/10/2026): every step's name under
// its bar - no mono counter, no frame numbers in a booking flow. Finished
// steps carry a ✓ and can be revisited; each step also says, out of
// sight, whether it is done, current or still to do.
function StepProgress({
  steps,
  current,
  onStepClick,
  label,
  statusLabels,
  className,
}: StepProgressProps) {
  return (
    <nav aria-label={label} className={cn("flex flex-col", className)}>
      <ol className="flex gap-1.5 md:gap-2">
        {steps.map((name, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = done && onStepClick !== undefined;
          const status = statusLabels
            ? done
              ? statusLabels.done
              : active
                ? statusLabels.current
                : statusLabels.todo
            : null;
          const frame = (
            <>
              <span
                aria-hidden
                className={cn(
                  "block h-1 w-full rounded-full transition-colors duration-[var(--fg-dur-260)] ease-fg-out",
                  done
                    ? "bg-brand-primary"
                    : active
                      ? "bg-gold-400"
                      : "bg-border-default",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 text-meta sm:text-body-sm",
                  active
                    ? "font-semibold! text-text-primary"
                    : done
                      ? "text-text-secondary"
                      : "text-text-tertiary",
                  !active && "max-sm:sr-only",
                )}
              >
                {done ? <span aria-hidden>✓</span> : null}
                <span className="truncate">{name}</span>
                {status ? <span className="sr-only">, {status}</span> : null}
              </span>
            </>
          );
          return (
            <li
              key={name}
              className="flex min-w-0 flex-1"
              aria-current={active ? "step" : undefined}
            >
              {clickable ? (
                <button
                  type="button"
                  data-interactive="true"
                  onClick={() => onStepClick(index)}
                  className="focus-ring flex min-h-11 w-full flex-col gap-1.5 rounded-[var(--fg-radius-sm)] pt-1 text-left hover:[&>span:last-child]:text-text-primary"
                >
                  {frame}
                </button>
              ) : (
                <span className="flex w-full flex-col gap-1.5 pt-1">
                  {frame}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
  StepProgress,
};
