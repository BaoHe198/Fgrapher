import { Skeleton } from "fgrapher";

export const ArtistCardLoading = () => (
  <div className="flex w-[300px] flex-col gap-3">
    <Skeleton className="aspect-[4/5] w-full rounded-[var(--fg-radius-lg)]" />
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-4 w-1/3" />
  </div>
);

export const ListRows = () => (
  <div className="flex max-w-md flex-col gap-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);
