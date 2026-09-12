import { cn } from "@/lib/utils";

/**
 * The two offset frames from the Fgrapher logomark, outline only, for
 * empty states where a photograph is meant to go.
 *
 * Replaces lucide's ImageOff at those call sites. A crossed-out picture
 * is a negative symbol — it reads as "this image is broken" — where the
 * actual message is "a photograph belongs here, add one". An empty frame
 * says that, and it says it in the brand's own shape.
 *
 * Deliberately not the LogoMark component: that one is a Client Component
 * because it reads the theme to pick a literal stroke colour. This uses
 * currentColor, so it inherits whatever muted tone its container already
 * has, works in both themes, and needs no JavaScript at all.
 */
export function FrameMark({
  size = 44,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={12}
      aria-hidden="true"
    >
      <rect x="20" y="20" width="120" height="120" rx="18" />
      <rect x="60" y="60" width="120" height="120" rx="18" opacity={0.45} />
    </svg>
  );
}
