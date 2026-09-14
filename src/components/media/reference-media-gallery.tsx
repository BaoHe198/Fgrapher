"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { mediaKindFromUrl } from "@/lib/media-kind";

/**
 * Read-only view of a customer's reference photos/videos, for whoever is on
 * the other side — the provider reading a booking or a service request, and
 * the customer reviewing their own.
 *
 * Replaces 64px <img> thumbnails that could not be opened. A provider is
 * trying to work out the look someone wants, which you cannot do from a
 * 64px square; and an <img> pointed at a video URL just rendered broken.
 * Tapping any tile now opens the shared lightbox, which plays video.
 */
export function ReferenceMediaGallery({
  urls,
  label,
}: {
  urls: string[];
  label?: string;
}) {
  const t = useTranslations("sharedComponents.referenceMedia");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (urls.length === 0) return null;

  const items = urls.map((url) => ({ url, type: mediaKindFromUrl(url) }));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-body-sm text-text-tertiary">
        {label ?? t("label")}
      </span>
      <div className="flex flex-wrap gap-2.5">
        {items.map((item, index) => (
          <button
            key={item.url}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={item.type === "VIDEO" ? t("viewVideo") : t("viewPhoto")}
            className="relative size-24 cursor-pointer overflow-hidden rounded-[var(--fg-radius-sm)] bg-bg-sunken focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
          >
            {item.type === "VIDEO" ? (
              <>
                <video
                  src={item.url}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-full object-cover"
                />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex size-8 items-center justify-center rounded-full bg-black/55 text-white">
                    <Play className="size-4 fill-current" />
                  </span>
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- small reference thumbnail, not worth next/image config
              <img src={item.url} alt="" className="size-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {openIndex !== null ? (
        <MediaLightbox
          items={items}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onIndexChange={setOpenIndex}
        />
      ) : null}
    </div>
  );
}
