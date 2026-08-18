"use client";

import type { MediaType } from "@prisma/client";
import { useState } from "react";
import Image from "next/image";

import { MediaLightbox } from "@/components/modals/media-lightbox";

interface MediaItem {
  id: string;
  url: string;
  type: MediaType;
  title: string | null;
}

const PAGE_SIZE = 12;

export function PortfolioTab({ media }: { media: MediaItem[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (media.length === 0) {
    return (
      <p className="py-12 text-center text-body-md text-text-secondary">
        No portfolio items yet
      </p>
    );
  }

  const visible = media.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="relative h-[200px] cursor-pointer overflow-hidden rounded-xl"
          >
            {item.type === "VIDEO" ? (
              <video src={item.url} className="size-full object-cover" muted />
            ) : (
              <Image src={item.url} alt={item.title ?? ""} fill className="object-cover" unoptimized />
            )}
          </button>
        ))}
      </div>

      {visibleCount < media.length ? (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="self-center text-body-md font-semibold text-text-link"
        >
          Load more
        </button>
      ) : null}

      {lightboxIndex !== null ? (
        <MediaLightbox
          items={visible}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  );
}
