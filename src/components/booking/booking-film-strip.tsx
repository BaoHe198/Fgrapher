import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";

// A booking's journey as a strip of film (owner, 16/11/2026): four frames
// - request sent, artist confirms, the shoot, the review. A finished step
// is an exposed frame, the step being waited on glows, the rest are still
// dark; a booking that ended early shows where it stopped. Presentational:
// the caller passes the status and the words, so both the customer's and
// the provider's pages can use it.

type Status =
  | "PENDING"
  | "CONFIRMED"
  | "DECLINED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "EXPIRED";

type FrameState = "exposed" | "current" | "stopped" | "dark";

interface BookingFilmStripProps {
  status: Status;
  hasReview: boolean;
  labels: {
    /** Accessible name of the whole strip. */
    title: string;
    requested: string;
    confirmed: string;
    shoot: string;
    review: string;
    /** Said after a frame's name for assistive tech. */
    done: string;
    current: string;
    upcoming: string;
    /** The status word for a booking that ended early ("Đã hủy"). */
    stopped: string;
  };
  className?: string;
}

function framesFor(status: Status, hasReview: boolean): FrameState[] {
  switch (status) {
    case "PENDING":
      return ["exposed", "current", "dark", "dark"];
    case "CONFIRMED":
      return ["exposed", "exposed", "current", "dark"];
    case "COMPLETED":
      return [
        "exposed",
        "exposed",
        "exposed",
        hasReview ? "exposed" : "current",
      ];
    case "NO_SHOW":
      return ["exposed", "exposed", "stopped", "dark"];
    // Declined, expired, or cancelled: it stopped at the confirmation
    // frame. (A booking cancelled after confirmation still reads as
    // stopped; which side of confirmation it was is in the timeline.)
    default:
      return ["exposed", "stopped", "dark", "dark"];
  }
}

const SPROCKETS =
  "h-3 bg-[radial-gradient(circle,rgb(255_255_255_/_0.85)_0_2.5px,transparent_3px)] bg-[size:18px_12px] bg-repeat-x";

export function BookingFilmStrip({
  status,
  hasReview,
  labels,
  className,
}: BookingFilmStripProps) {
  const states = framesFor(status, hasReview);
  const names = [
    labels.requested,
    labels.confirmed,
    labels.shoot,
    labels.review,
  ];

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--fg-radius-lg)] bg-[#141210] text-white",
        className,
      )}
    >
      <div aria-hidden className={SPROCKETS} />
      <ol
        aria-label={labels.title}
        className="grid grid-cols-4 gap-1.5 px-2 py-1.5"
      >
        {names.map((name, index) => {
          const state = states[index];
          return (
            <li
              key={name}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "relative flex min-h-[76px] flex-col justify-between rounded-[4px] p-2.5 transition-colors duration-[var(--fg-dur-260)] sm:min-h-[88px] sm:p-3",
                // Fixed ink, not text-neutral-900: the strip is the same dark film
                // in both themes, and the neutral scale inverts in dark mode,
                // which put near-white type on this pale frame (1.1:1).
                state === "exposed" && "bg-gold-100 text-[#141210]",
                state === "current" &&
                  "bg-gold-400 text-white ring-2 ring-gold-200",
                state === "stopped" && "bg-[#5a2420] text-white",
                state === "dark" && "bg-[#26221e] text-white/60",
              )}
            >
              <span className="flex items-center justify-between font-mono text-meta tracking-[0.08em]">
                <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                {state === "exposed" ? (
                  <Check aria-hidden className="size-4" />
                ) : state === "stopped" ? (
                  <X aria-hidden className="size-4" />
                ) : state === "current" ? (
                  <span
                    aria-hidden
                    className="size-2 animate-fg-pulse rounded-full bg-[#141210]"
                  />
                ) : null}
              </span>
              <span className="text-body-sm leading-[1.25] font-semibold max-sm:text-[12px]">
                {name}
                <span className="sr-only">
                  {" – "}
                  {state === "exposed"
                    ? labels.done
                    : state === "current"
                      ? labels.current
                      : state === "stopped"
                        ? labels.stopped
                        : labels.upcoming}
                </span>
                {state === "stopped" ? (
                  <span aria-hidden className="block font-normal text-white/80">
                    {labels.stopped}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className={SPROCKETS} />
    </div>
  );
}
