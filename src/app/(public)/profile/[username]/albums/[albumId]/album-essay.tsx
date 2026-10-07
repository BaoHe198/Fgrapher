"use client";

import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useState, ViewTransition } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { Button } from "@/components/ui/button";
import { buildMediaVariants } from "@/lib/media/variants";
import { cn } from "@/lib/utils";

interface EssayPhoto {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  width: number | null;
  height: number | null;
  caption: string | null;
}

interface AlbumEssayProps {
  album: {
    id: string;
    title: string;
    description: string | null;
    /** Place, date, style - whichever exist. */
    meta: string[];
    style: string | null;
  };
  photos: EssayPhoto[];
  artist: { name: string; href: string; bookingHref: string | null };
}

type Block =
  | { kind: "full"; photos: [number] }
  | { kind: "pair"; photos: [number, number] }
  | { kind: "inset"; photos: [number] };

// The essay's rhythm: one photo the full width, then a pair, then one set
// beside its caption, a pair again, and back to full width. Fixed, so the
// artist's order is never shuffled to fit a layout.
function layout(count: number): Block[] {
  const blocks: Block[] = [];
  const cycle = ["pair", "inset", "pair", "full"] as const;
  let i = 0;
  if (count > 0) blocks.push({ kind: "full", photos: [i++] });
  let step = 0;
  while (i < count) {
    const kind = cycle[step % cycle.length];
    step += 1;
    if (kind === "pair" && i + 1 < count) {
      blocks.push({ kind, photos: [i, i + 1] });
      i += 2;
    } else if (kind === "inset") {
      blocks.push({ kind, photos: [i++] });
    } else {
      blocks.push({ kind: "full", photos: [i++] });
    }
  }
  return blocks;
}

export function AlbumEssay({ album, photos, artist }: AlbumEssayProps) {
  const t = useTranslations("publicPages.album");
  const [open, setOpen] = useState<number | null>(null);

  const originFor = useCallback(
    (index: number) =>
      document.querySelector<HTMLElement>(`[data-essay-index="${index}"]`),
    [],
  );

  const photo = (index: number, sizes: string, eager = false) => {
    const item = photos[index];
    const image =
      item.type === "VIDEO" ? (
        <video
          src={item.url}
          controls
          playsInline
          className="block h-auto max-h-[92vh] w-full bg-dr-bg object-contain"
        />
      ) : (
        <Image
          src={buildMediaVariants(item.url).large}
          alt={item.caption ?? t("photoAlt", { frame: index + 1 })}
          width={item.width ?? 1600}
          height={item.height ?? 1067}
          unoptimized
          priority={eager}
          sizes={sizes}
          className={cn(
            "block h-auto max-h-[92vh] w-full object-contain",
            !eager && "animate-develop",
          )}
        />
      );
    return (
      <button
        type="button"
        data-essay-index={index}
        onClick={() => setOpen(index)}
        aria-label={t("open", { frame: index + 1 })}
        className="focus-ring block w-full cursor-zoom-in"
      >
        {index === 0 ? (
          // The cover flies here from the profile's album grid.
          <ViewTransition
            name={`album-${album.id}`}
            share="morph"
            default="none"
          >
            {image}
          </ViewTransition>
        ) : (
          image
        )}
      </button>
    );
  };

  const caption = (index: number) =>
    photos[index].caption ? <span>{photos[index].caption}</span> : null;

  return (
    <article
      aria-labelledby="album-title"
      className="min-h-screen bg-dr-bg text-dr-text"
    >
      <div className="sticky top-[72px] z-10 border-b border-dr-line bg-dr-bg">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-[clamp(16px,4vw,48px)]">
          <Link
            href={artist.href}
            className="focus-ring inline-flex min-w-0 items-center gap-1.5 rounded-[var(--fg-radius-sm)] text-body-sm font-semibold text-dr-text"
          >
            <ChevronLeft aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{artist.name}</span>
          </Link>
          <span className="font-mono text-meta tracking-[0.12em] text-dr-text-3 uppercase max-sm:hidden">
            {t("bar", { count: photos.length })}
          </span>
          {artist.bookingHref ? (
            <Button
              variant="accent"
              size="sm"
              nativeButton={false}
              render={<Link href={artist.bookingHref} />}
            >
              {t("book")}
            </Button>
          ) : (
            <span />
          )}
        </div>
      </div>

      <header className="mx-auto flex max-w-[1200px] flex-col gap-5 px-[clamp(16px,4vw,48px)] pt-[clamp(40px,7vw,112px)] pb-[clamp(32px,5vw,72px)]">
        <span className="font-mono text-meta tracking-[0.12em] text-dr-text-3 uppercase">
          {t("eyebrow", { count: photos.length })}
        </span>
        <h1
          id="album-title"
          className="font-display text-[clamp(2.5rem,calc(0.75rem+5vw),6.5rem)] leading-[0.94] font-semibold tracking-[-0.035em] text-balance break-words"
        >
          {album.title}
        </h1>
        <span className="text-[15px] text-dr-text-2">
          {[...album.meta, t("count", { count: photos.length })].join(" · ")}
        </span>
        {album.description ? (
          <p className="max-w-[640px] text-[clamp(17px,1.4vw,20px)] leading-[1.6] text-pretty whitespace-pre-line">
            {album.description}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-[clamp(40px,7vw,120px)] px-[clamp(12px,4vw,48px)] pb-[clamp(64px,8vw,120px)]">
        {layout(photos.length).map((block, b) => {
          if (block.kind === "pair") {
            return (
              <div
                key={b}
                className="mx-auto grid w-full max-w-[1200px] items-end gap-[clamp(12px,2vw,24px)] sm:grid-cols-2"
              >
                {block.photos.map((index) => (
                  <figure key={index} className="flex flex-col gap-3">
                    {photo(index, "(min-width: 640px) 50vw, 100vw")}
                    <figcaption className="flex gap-3 text-body-sm text-dr-text-2">
                      {caption(index)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            );
          }
          const index = block.photos[0];
          if (block.kind === "inset") {
            return (
              <figure
                key={b}
                className="mx-auto grid w-full max-w-[1100px] items-end gap-[clamp(16px,3vw,48px)] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
              >
                <div className="max-w-[720px]">
                  {photo(index, "(min-width: 768px) 60vw, 100vw")}
                </div>
                <figcaption className="flex flex-col gap-2.5 pb-2">
                  {photos[index].caption ? (
                    <span className="text-[17px] leading-[1.6] text-pretty">
                      {photos[index].caption}
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            );
          }
          return (
            <figure
              key={b}
              className="mx-auto flex w-full max-w-[1320px] flex-col gap-3"
            >
              {photo(index, "100vw", b === 0)}
              <figcaption className="flex gap-3 text-body-sm text-dr-text-2">
                {caption(index)}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <footer className="mx-auto flex max-w-[1200px] flex-col gap-7 px-[clamp(16px,4vw,48px)] pb-[clamp(64px,8vw,120px)]">
        <div
          aria-hidden
          className="flex justify-between border-t border-dr-line-2 pt-4 font-mono text-meta tracking-[0.12em] text-dr-text-3 uppercase"
        >
          <span>{t("end")}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <p className="text-heading-md">{t("by", { name: artist.name })}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={artist.href} />}
            >
              {t("viewProfile")}
            </Button>
            {artist.bookingHref ? (
              <Button
                variant="accent"
                nativeButton={false}
                render={<Link href={artist.bookingHref} />}
              >
                {t("book")}
              </Button>
            ) : null}
          </div>
        </div>
      </footer>

      {open !== null ? (
        <MediaLightbox
          items={photos.map((p) => ({
            url: p.url,
            title: p.caption,
            type: p.type,
          }))}
          index={open}
          onClose={() => setOpen(null)}
          onIndexChange={setOpen}
          originFor={originFor}
          title={album.title}
          categoryLabel={album.style ?? undefined}
        />
      ) : null}
    </article>
  );
}
