import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-fg-pulse rounded-[var(--fg-radius-sm)] bg-bg-sunken dark:bg-neutral-100",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
