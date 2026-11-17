import { ImageIcon, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buildMediaVariants } from "@/lib/media/variants";

export interface BrowseArtist {
  id: string;
  name: string;
  username: string;
  /** The first role only ("Nhiếp ảnh gia"). */
  role: string;
  /** Short place ("Thủ Đức, TP. Hồ Chí Minh"), or "". */
  place: string;
  /** "4,9", or null before the first review. */
  rating: string | null;
  reviews: number;
  /** "2.500.000₫", or null when the artist quotes on request. */
  priceFrom: string | null;
  cover: string | null;
  /** "Còn lịch 10/10" when the search has a shoot date. */
  availability?: string;
  /** "Nhận lịch toàn quốc" in the nationwide backfill. */
  badge?: string;
}

interface Labels {
  from: string;
  askPrice: string;
  isNew: string;
  noPhoto: string;
  /** The whole card's accessible name. */
  aria: string;
}

// Tìm kiếm F's artist card. The whole card is one link - one tab stop, the
// image's alt left empty because the name is in the link's label.
export function BrowseArtistCard({
  artist,
  labels,
  eager = false,
}: {
  artist: BrowseArtist;
  labels: Labels;
  eager?: boolean;
}) {
  const subline = [artist.role, artist.place].filter(Boolean).join(" · ");

  // Airbnb's listing card (owner, 17/11/2026): a clean square photo with at
  // most a pill or two on its corner, then the name, what and where, and
  // the price with the rating on one line. Nothing sits over the picture
  // that a photographer's work has to compete with.
  return (
    <Link
      href={`/profile/${artist.username}`}
      aria-label={labels.aria}
      data-shutter
      className="focus-ring group flex min-w-0 flex-col gap-2.5 rounded-[var(--fg-radius-lg)] text-text-primary"
    >
      <span className="relative block aspect-square overflow-hidden rounded-[var(--fg-radius-lg)] bg-bg-sunken">
        {artist.cover ? (
          <Image
            src={buildMediaVariants(artist.cover).medium}
            alt=""
            fill
            unoptimized
            priority={eager}
            loading={eager ? "eager" : "lazy"}
            sizes="(max-width: 767px) 50vw, (max-width: 1439px) 33vw, 320px"
            className="object-cover transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="absolute inset-0 grid place-content-center justify-items-center gap-1.5 p-2 text-center text-meta text-text-secondary">
            <ImageIcon aria-hidden className="size-6" />
            {labels.noPhoto}
          </span>
        )}
        <span className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {artist.availability ? (
            <span className="rounded-full bg-bg-surface/95 px-2.5 py-1 text-meta font-semibold text-success shadow-[var(--shadow-sm)]">
              {artist.availability}
            </span>
          ) : null}
          {artist.badge ? (
            <span className="rounded-full bg-bg-surface/95 px-2.5 py-1 text-meta font-semibold text-text-primary shadow-[var(--shadow-sm)]">
              {artist.badge}
            </span>
          ) : null}
          {!artist.rating && !artist.availability && !artist.badge ? (
            <span className="rounded-full bg-bg-surface/95 px-2.5 py-1 text-meta font-semibold text-text-primary shadow-[var(--shadow-sm)]">
              {labels.isNew}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <strong className="truncate text-body-md font-semibold">
          {artist.name}
        </strong>
        {subline ? (
          <span className="truncate text-body-sm text-text-secondary">
            {subline}
          </span>
        ) : null}
        <span className="flex items-center gap-1 text-body-sm text-text-secondary">
          {artist.priceFrom ? (
            <span>
              {labels.from}{" "}
              <strong className="font-semibold text-text-primary tabular-nums">
                {artist.priceFrom}
              </strong>
            </span>
          ) : (
            <span>{labels.askPrice}</span>
          )}
          {artist.rating ? (
            <>
              <span aria-hidden>·</span>
              <Star aria-hidden className="size-3 fill-current" />
              <span>
                {artist.rating} ({artist.reviews})
              </span>
            </>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
