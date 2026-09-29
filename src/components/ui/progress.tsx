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
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

// The steps variant: a strip of film frames with a mono frame counter
// ("03/06"), the Fgrapher answer to numbered circles (audit §06). Finished
// frames are brand-primary, the current one is gold - a "develop" moment -
// and the rest wait on the sunken track. Frame labels hide on phones; the
// counter and the current step's name above the strip carry it there.
function StepProgress({
  steps,
  current,
  onStepClick,
  label,
  className,
}: StepProgressProps) {
  return (
    <nav aria-label={label} className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-sm font-semibold! text-text-primary md:invisible">
          {steps[current]}
        </span>
        <span className="font-mono text-meta tabular-nums text-text-tertiary">
          {pad(current + 1)}/{pad(steps.length)}
        </span>
      </div>
      <ol className="flex gap-1.5 md:gap-2">
        {steps.map((name, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = done && onStepClick !== undefined;
          const frame = (
            <>
              <span
                aria-hidden
                className={cn(
                  "block h-1.5 w-full rounded-full transition-colors duration-[var(--fg-dur-260)] ease-fg-out",
                  done
                    ? "bg-brand-primary"
                    : active
                      ? "bg-gold-400"
                      : "bg-bg-sunken",
                )}
              />
              <span
                className={cn(
                  "hidden items-center gap-2 text-body-sm md:flex",
                  active
                    ? "font-semibold! text-text-primary"
                    : done
                      ? "text-text-secondary"
                      : "text-text-tertiary",
                )}
              >
                <span className="font-mono text-meta tabular-nums">
                  {pad(index + 1)}
                </span>
                <span className="truncate">{name}</span>
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
                  className="focus-ring flex w-full flex-col gap-2 rounded-[var(--fg-radius-sm)] text-left hover:[&>span:last-child]:text-text-primary"
                >
                  {frame}
                </button>
              ) : (
                <span className="flex w-full flex-col gap-2">{frame}</span>
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
