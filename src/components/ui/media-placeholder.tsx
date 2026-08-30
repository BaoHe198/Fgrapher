import { cn } from "@/lib/utils";

interface MediaPlaceholderProps {
  /** A brand scale token name, e.g. "green-300", "gold-200" — resolved via
   * var(--{tint}). (Later phase-1 steps call this with short token names,
   * not literal CSS colors, so that is the format supported here.) */
  tint: string;
  height?: number | string;
  radius?: number;
  label?: string;
  className?: string;
}

function MediaPlaceholder({
  tint,
  height = 200,
  radius = 0,
  label,
  className,
}: MediaPlaceholderProps) {
  return (
    <div
      data-slot="media-placeholder"
      className={cn("flex items-center justify-center", className)}
      style={{
        backgroundColor: `var(--${tint})`,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: typeof radius === "number" ? `${radius}px` : radius,
      }}
    >
      {label ? (
        <span className="text-body-sm font-medium! text-neutral-900/40">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export { MediaPlaceholder };
