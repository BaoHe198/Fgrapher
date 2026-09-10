import { Skeleton } from "@/components/ui/skeleton";

// Shared between the messages route's loading.tsx (server-fetch delay)
// and messages-client.tsx's own brief "session not hydrated yet" window
// (SessionProvider isn't seeded with an SSR session, so useSession()
// genuinely fetches client-side even after the page itself has
// rendered) — without this, that second window showed a second blank
// flash right after the first skeleton resolved.
export function MessagesSkeleton() {
  return (
    <div className="grid h-[calc(100dvh-140px)] min-h-[480px] grid-cols-1 overflow-hidden rounded-[var(--fg-radius-lg)] border border-border-subtle bg-surface-card lg:h-[calc(100dvh-180px)] lg:grid-cols-[340px_1fr]">
      <div className="hidden h-full flex-col gap-3 border-r border-border-subtle p-4 lg:flex">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex h-full flex-col gap-3 p-4 lg:hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden h-full flex-col lg:flex">
        <div className="flex items-center gap-3 border-b border-border-subtle p-4">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 p-4">
          <Skeleton className="h-9 w-2/5 self-start rounded-2xl" />
          <Skeleton className="h-9 w-1/3 self-end rounded-2xl" />
          <Skeleton className="h-9 w-1/2 self-start rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
