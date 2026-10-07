"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { Button } from "@/components/ui/button";
import { MasonryGrid } from "@/components/ui/masonry-grid";

export interface BrowsePhoto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  artistName: string;
  username: string;
  /** Set when the artist takes bookings (costume shops rent by chat). */
  bookingHref: string | null;
}

// "Theo ảnh": every approved photo of the artists matching the search, in
// a grid that keeps each photo's own ratio. A photo opens in the
// lightbox, flying from its tile, with the way on to that artist.
export function BrowsePhotoGrid({ photos }: { photos: BrowsePhoto[] }) {
  const t = useTranslations("publicPages.browseV2.photos");
  const [open, setOpen] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const originFor = useCallback(
    (index: number) =>
      gridRef.current?.querySelector<HTMLElement>(
        `[data-frame-index="${index}"]`,
      ) ?? null,
    [],
  );

  const current = open === null ? null : photos[open];

  return (
    <div ref={gridRef}>
      <MasonryGrid
        items={photos.map((photo) => ({
          id: photo.id,
          src: photo.url,
          width: photo.width,
          height: photo.height,
          alt: t("alt", { name: photo.artistName }),
        }))}
        showModeSwitch
        storageKey="fg:browse-photo-mode"
        onOpen={setOpen}
        renderOverlay={(_, index) => (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-[var(--dr-scrim)] to-transparent px-2.5 pt-6 pb-2 text-body-sm font-semibold text-on-photo opacity-0 transition-opacity duration-[var(--fg-dur-200)] group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100">
            {photos[index].artistName}
          </span>
        )}
      />
      {current && open !== null ? (
        <MediaLightbox
          items={photos.map((photo) => ({
            url: photo.url,
            title: photo.artistName,
            type: "IMAGE" as const,
          }))}
          index={open}
          onClose={() => setOpen(null)}
          onIndexChange={setOpen}
          originFor={originFor}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/profile/${current.username}`} />}
              >
                {t("viewProfile")}
              </Button>
              {current.bookingHref ? (
                <Button
                  variant="accent"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={current.bookingHref} />}
                >
                  {t("book")}
                </Button>
              ) : null}
            </>
          }
        />
      ) : null}
    </div>
  );
}
