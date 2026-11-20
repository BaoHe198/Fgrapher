"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { MasonryGrid } from "@/components/ui/masonry-grid";
import { buildMediaVariants } from "@/lib/media/variants";

interface PlaceGalleryProps {
  placeName: string;
  photos: {
    id: string;
    url: string;
    width: number | null;
    height: number | null;
    caption: string | null;
  }[];
}

/** A spot's own photos at their real ratio, opening the shared viewer. */
export function PlaceGallery({ placeName, photos }: PlaceGalleryProps) {
  const t = useTranslations("places.detail");
  const [open, setOpen] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const originFor = useCallback(
    (index: number) =>
      gridRef.current?.querySelector<HTMLElement>(
        `[data-frame-index="${index}"]`,
      ) ?? null,
    [],
  );

  if (photos.length === 0) return null;

  return (
    <section aria-label={t("photos")}>
      <div ref={gridRef}>
        <MasonryGrid
          items={photos.map((photo, index) => ({
            id: photo.id,
            src: buildMediaVariants(photo.url).medium,
            width: photo.width,
            height: photo.height,
            alt: photo.caption ?? t("openPhoto", { number: index + 1 }),
          }))}
          onOpen={setOpen}
        />
      </div>
      {open !== null ? (
        <MediaLightbox
          items={photos.map((photo) => ({
            url: photo.url,
            title: photo.caption,
            type: "IMAGE" as const,
          }))}
          index={open}
          onClose={() => setOpen(null)}
          onIndexChange={setOpen}
          originFor={originFor}
          title={placeName}
        />
      ) : null}
    </section>
  );
}
