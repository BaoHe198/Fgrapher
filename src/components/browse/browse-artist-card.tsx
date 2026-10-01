import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { frameLabel } from "@/lib/media/frame-label";
import { buildMediaVariants } from "@/lib/media/variants";

export interface BrowseArtist {
  id: string;
  name: string;
  username: string;
  /** "Nhiếp ảnh gia, Quay phim". */
  roles: string;
  place: string;
  /** null until the first review: no stars, not "0,0". */
  rating: string | null;
  reviews: number;
  /** "Từ 2.500.000₫" or "Liên hệ báo giá". */
  price: React.ReactNode;
  /** Approved images, the cover first. */
  photos: string[];
  /** "Còn lịch 12/10/2026" when the search has a shoot date. */
  availability?: string;
  /** "Nhận lịch toàn quốc" in the nationwide backfill. */
  badge?: string;
}

// Tìm kiếm F v2's card: a 4:5 cover with nothing on it but an availability
// tag, and on hover or focus a strip of the next three frames over a
// darkroom scrim - a glance at the portfolio without leaving the grid.
// The cover is the one image a card may crop (kit §05); the profile and
// its albums never do.
export function BrowseArtistCard({
  artist,
  priority = false,
}: {
  artist: BrowseArtist;
  priority?: boolean;
}) {
  const [cover, ...rest] = artist.photos;
  const strip = rest.slice(0, 3);
  const headingId = `artist-${artist.id}`;
  return (
    <article
      aria-labelledby={headingId}
      className="group/card flex min-w-0 flex-col gap-3"
    >
      <Link
        href={`/profile/${artist.username}`}
        aria-labelledby={headingId}
        className="focus-ring relative block aspect-[4/5] overflow-hidden rounded-[var(--fg-radius-md)] bg-bg-sunken"
      >
        {cover ? (
          <Image
            src={buildMediaVariants(cover).medium}
            alt=""
            fill
            unoptimized
            priority={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover/card:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
          />
        ) : (
          // No approved photo yet: the initial on the sunken ground, never
          // a stock picture.
          <span
            aria-hidden
            className="absolute inset-0 grid place-items-center font-display text-[4rem] font-semibold text-text-tertiary"
          >
            {artist.name[0]?.toUpperCase()}
          </span>
        )}
        {artist.availability || artist.badge ? (
          <span className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
            {artist.availability ? (
              <span className="rounded-[4px] bg-bg-surface px-2 py-1.5 font-mono text-meta font-bold tracking-[0.12em] text-text-primary uppercase shadow-[var(--shadow-sm)]">
                {artist.availability}
              </span>
            ) : null}
            {artist.badge ? (
              <span className="rounded-[4px] bg-bg-surface px-2 py-1.5 text-meta font-semibold text-text-primary shadow-[var(--shadow-sm)]">
                {artist.badge}
              </span>
            ) : null}
          </span>
        ) : null}
        {strip.length > 0 ? (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 grid translate-y-2 grid-cols-3 gap-0.5 bg-linear-to-t from-[var(--dr-scrim)] to-transparent px-2 pt-7 pb-2 opacity-0 transition-[opacity,translate] duration-[var(--fg-dur-200)] ease-fg-out group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100 group-hover/card:translate-y-0 group-hover/card:opacity-100 max-md:hidden motion-reduce:transition-none"
          >
            {strip.map((src, i) => (
              <span key={src} className="flex flex-col gap-1">
                <span className="relative block aspect-square bg-dr-bg">
                  <Image
                    src={buildMediaVariants(src).thumbnail}
                    alt=""
                    fill
                    unoptimized
                    sizes="96px"
                    className="object-contain p-0.5"
                  />
                </span>
                <span className="font-mono text-meta text-dr-text">
                  {frameLabel(i * 6)}
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2.5">
          <h3
            id={headingId}
            className="line-clamp-2 min-w-0 text-[17px] leading-[1.3] font-semibold text-text-primary"
          >
            <Link
              href={`/profile/${artist.username}`}
              className="focus-visible:underline"
              tabIndex={-1}
            >
              {artist.name}
            </Link>
          </h3>
          {artist.rating ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-body-sm font-semibold text-text-primary">
              <Star aria-hidden className="size-3.5 fill-current" />
              {artist.rating}
              <span className="font-normal text-text-secondary">
                ({artist.reviews})
              </span>
            </span>
          ) : null}
        </div>
        <span className="truncate text-body-sm text-text-secondary">
          {artist.roles}
          {artist.place ? ` · ${artist.place}` : ""}
        </span>
        <span className="mt-0.5 text-[15px] text-text-primary">
          {artist.price}
        </span>
      </div>
    </article>
  );
}
