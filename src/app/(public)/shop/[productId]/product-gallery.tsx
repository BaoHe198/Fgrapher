"use client";

import Image from "next/image";
import { useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  name,
}: {
  images: { url: string }[];
  name: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) {
    return (
      <div className="overflow-hidden rounded-[var(--fg-radius-lg)]">
        <MediaPlaceholder tint="neutral-300" height={420} label={name} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--fg-radius-lg)]"
      >
        <Image src={images[activeIndex].url} alt={name} fill className="object-cover" />
      </button>

      {images.length > 1 ? (
        <div className="flex gap-2.5 overflow-x-auto">
          {images.map((img, index) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-[var(--fg-radius-sm)]",
                index === activeIndex ? "ring-2 ring-brand-primary" : "",
              )}
            >
              <Image src={img.url} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxOpen ? (
        <MediaLightbox
          items={images}
          index={activeIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setActiveIndex}
        />
      ) : null}
    </div>
  );
}
