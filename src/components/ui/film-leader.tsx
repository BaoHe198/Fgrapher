import { cn } from "@/lib/utils";

// The edge between Giấy and Phòng tối (wave 2 kit §01): a hard cut marked
// by a 32px film leader - two rows of sprocket holes and a mono label for
// the block it leads into ("ALBUM", "04A ▸"). Never a colour fade: the
// middle of a gradient leaves grey text without contrast and makes photos
// there look muddy. Static, so it stays under reduced motion.
export function FilmLeader({
  label,
  trailing,
  className,
}: {
  label?: string;
  trailing?: string;
  className?: string;
}) {
  return (
    <div
      data-surface="darkroom"
      data-slot="film-leader"
      aria-hidden={!label}
      className={cn(
        "relative flex h-8 items-center justify-between overflow-hidden bg-dr-bg px-5 font-mono text-meta leading-none tracking-[0.12em] text-dr-text-3 uppercase",
        // Sprocket holes: two rows of rounded rectangles in --dr-line-2.
        "before:absolute before:inset-x-0 before:top-1 before:h-1.5 before:bg-[radial-gradient(closest-side,var(--dr-line-2)_96%,transparent)] before:bg-[length:14px_6px] before:bg-repeat-x",
        "after:absolute after:inset-x-0 after:bottom-1 after:h-1.5 after:bg-[radial-gradient(closest-side,var(--dr-line-2)_96%,transparent)] after:bg-[length:14px_6px] after:bg-repeat-x",
        className,
      )}
    >
      <span className="relative">{label}</span>
      {trailing ? <span className="relative">{trailing}</span> : null}
    </div>
  );
}
