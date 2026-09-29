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

// Loading placeholders shaped like what is coming (system audit 09/2026
// §02: "khung xương đúng kích thước thật") instead of a lone spinner in an
// empty page. ListSkeleton for a list of rows or cards, DetailSkeleton for
// a single record's page.
function ListSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      data-slot="list-skeleton"
      className={cn("flex flex-col gap-3", className)}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-[var(--fg-radius-lg)] border border-border-subtle bg-bg-surface p-4"
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-8 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      data-slot="detail-skeleton"
      className={cn("flex flex-col gap-6 py-2", className)}
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Skeleton className="h-56 rounded-[var(--fg-radius-lg)]" />
        <Skeleton className="h-56 rounded-[var(--fg-radius-lg)]" />
      </div>
      <Skeleton className="h-32 rounded-[var(--fg-radius-lg)]" />
    </div>
  );
}

export { Skeleton, ListSkeleton, DetailSkeleton };
