import { ArrowRight, ImageIcon, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buildMediaVariants } from "@/lib/media/variants";
import { cn } from "@/lib/utils";

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

// Tìm kiếm F's artist card (Core MVP pass, 02/10/2026). The whole card is
// one link - one tab stop, the image's alt left empty because the name is
// in the link's label. Under 430px it is a row (a 112×140 photo beside the
// text); from 430px a column with the name and place on the photo and the
// price on one line below, so prices line up whatever the name's length.
// The rating never shares a line with the name: on the photo's corner in
// a column, on the last line in a row. One film motif since 16/11/2026 (owner): the
// viewfinder corners on hover and the shutter on press.
export function BrowseArtistCard({
  artist,
  labels,
  eager = false,
}: {
  artist: BrowseArtist;
  labels: Labels;
  eager?: boolean;
}) {
  const rating = artist.rating ? (
    <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
      <Star aria-hidden className="size-3.5 fill-current" />
      {artist.rating}
      <span className="font-normal text-text-secondary">
        ({artist.reviews})
      </span>
    </span>
  ) : (
    <span className="rounded-[4px] bg-bg-sunken px-1.5 py-0.5 font-semibold text-text-primary">
      {labels.isNew}
    </span>
  );
  const price = artist.priceFrom ? (
    <span className="text-[15px] leading-[1.3]">
      <span className="text-text-secondary">{labels.from} </span>
      <strong className="font-semibold tabular-nums">{artist.priceFrom}</strong>
    </span>
  ) : (
    <span className="text-[15px] leading-[1.3] text-text-secondary">
      {labels.askPrice}
    </span>
  );
  const subline = [artist.role, artist.place].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/profile/${artist.username}`}
      aria-label={labels.aria}
      data-viewfinder
      data-shutter
      className="focus-ring group grid min-w-0 grid-cols-[112px_minmax(0,1fr)] gap-3.5 rounded-[var(--fg-radius-md)] text-text-primary min-[430px]:flex min-[430px]:flex-col min-[430px]:gap-2.5"
    >
      <span className="relative block aspect-[4/5] overflow-hidden rounded-[var(--fg-radius-md)] bg-bg-sunken transition-[transform,box-shadow] duration-[var(--fg-dur-260)] ease-fg-out min-[430px]:group-hover:-translate-y-1 min-[430px]:group-hover:shadow-[var(--shadow-lg)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        {artist.cover ? (
          <Image
            src={buildMediaVariants(artist.cover).medium}
            alt=""
            fill
            unoptimized
            priority={eager}
            loading={eager ? "eager" : "lazy"}
            sizes="(max-width: 429px) 112px, (max-width: 767px) 50vw, (max-width: 1439px) 33vw, 320px"
            className="object-cover transition-transform duration-[var(--fg-dur-400)] ease-fg-out group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <span className="absolute inset-0 grid place-content-center justify-items-center gap-1.5 p-2 text-center text-meta text-text-secondary">
            <ImageIcon aria-hidden className="size-6" />
            {labels.noPhoto}
          </span>
        )}
        {artist.cover ? (
          <span
            aria-hidden
            className="viewfinder top-12! bottom-20! max-[429px]:hidden"
          />
        ) : null}
        {/* On the photo in the column layout only. */}
        <span className="absolute top-2 right-2 hidden rounded-full bg-bg-surface px-2 py-1 text-body-sm shadow-[var(--shadow-sm)] min-[430px]:block">
          {rating}
        </span>
        {artist.availability || artist.badge ? (
          <span className="absolute top-2 left-2 hidden flex-col items-start gap-1 min-[430px]:flex">
            {artist.availability ? (
              <span className="rounded-full bg-success-bg px-2 py-1 text-body-sm font-semibold text-success">
                {artist.availability}
              </span>
            ) : null}
            {artist.badge ? (
              <span className="rounded-full bg-bg-surface px-2 py-1 text-body-sm font-semibold text-text-primary shadow-[var(--shadow-sm)]">
                {artist.badge}
              </span>
            ) : null}
          </span>
        ) : null}
        {/* Column layout: the name and place sit on the photo (owner,
            16/11/2026), so the card reads as one picture. A card with no
            photo keeps dark text on its quiet slot. */}
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 hidden flex-col gap-0.5 px-3 pt-12 pb-3 min-[430px]:flex",
            artist.cover
              ? "bg-gradient-to-t from-black/80 via-black/35 to-transparent text-white"
              : "text-text-primary",
          )}
        >
          <strong className="line-clamp-2 text-[17px] leading-[1.25] font-semibold break-words">
            {artist.name}
          </strong>
          {subline ? (
            <span
              className={cn(
                "truncate text-body-sm",
                artist.cover ? "text-white/85" : "text-text-secondary",
              )}
            >
              {subline}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-1 py-0.5 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between min-[430px]:gap-2 min-[430px]:px-1 min-[430px]:py-0">
        {/* Row layout (narrow phones): name and place beside the photo. */}
        <strong className="line-clamp-2 text-[16px] leading-[1.3] font-semibold break-words min-[430px]:hidden">
          {artist.name}
        </strong>
        {subline ? (
          <span className="truncate text-body-sm text-text-secondary min-[430px]:hidden">
            {subline}
          </span>
        ) : null}
        <span className="mt-auto flex flex-col gap-1 min-[430px]:mt-0">
          {price}
          {/* The row layout keeps rating and availability on the last line. */}
          <span className="flex min-w-0 items-center gap-2.5 text-[13px] leading-[1.3] text-text-secondary min-[430px]:hidden">
            {rating}
            {artist.availability ? (
              <span className="truncate text-success">
                {artist.availability}
              </span>
            ) : null}
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="hidden size-4 shrink-0 -translate-x-1 text-text-secondary opacity-0 transition-[opacity,transform] duration-[var(--fg-dur-260)] ease-fg-out group-hover:translate-x-0 group-hover:opacity-100 min-[430px]:block motion-reduce:transition-none"
        />
      </span>
    </Link>
  );
}
