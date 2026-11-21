"use client";

import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { FgImage } from "@/components/ui/fg-image";
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

/**
 * A spot's photos: the cover large, as the page's first impression (a
 * grid of small tiles made a strong photo look like a thumbnail — 21/11
 * walk-through), then the rest at their real ratio. All open the viewer.
 */
export function PlaceGallery({ placeName, photos }: PlaceGalleryProps) {
  const t = useTranslations("places.detail");
  const [open, setOpen] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const originFor = useCallback(
    (index: number) =>
      rootRef.current?.querySelector<HTMLElement>(
        index === 0 ? "[data-hero]" : `[data-frame-index="${index - 1}"]`,
      ) ?? null,
    [],
  );

  if (photos.length === 0) return null;
  const [hero, ...rest] = photos;

  return (
    <section
      aria-label={t("photos")}
      ref={rootRef}
      className="flex flex-col gap-2 md:gap-3"
    >
      <button
        type="button"
        data-hero
        onClick={() => setOpen(0)}
        aria-label={t("openPhoto", { number: 1 })}
        className="focus-ring block w-full cursor-zoom-in rounded-[var(--fg-radius-md)]"
      >
        <FgImage
          src={buildMediaVariants(hero.url).large}
          alt={hero.caption ?? placeName}
          ratio="16/9"
          rounded="md"
          priority
          sizes="(min-width: 1280px) 1200px, 100vw"
        />
      </button>
      {rest.length > 0 ? (
        <MasonryGrid
          items={rest.map((photo, index) => ({
            id: photo.id,
            src: buildMediaVariants(photo.url).medium,
            width: photo.width,
            height: photo.height,
            alt: photo.caption ?? t("openPhoto", { number: index + 2 }),
          }))}
          onOpen={(index) => setOpen(index + 1)}
        />
      ) : null}
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
