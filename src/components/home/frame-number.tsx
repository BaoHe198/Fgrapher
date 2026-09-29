import { cn } from "@/lib/utils";

// The contact-sheet frame number ("02", "08") stamped on home-page photos -
// the "01A" language of the hero carried through the page (audit §06).
export function FrameNumber({
  n,
  className,
}: {
  n: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "rounded-[4px] bg-green-950/80 px-1.5 py-0.5 font-mono text-meta leading-none text-gold-50 tabular-nums",
        className,
      )}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}
