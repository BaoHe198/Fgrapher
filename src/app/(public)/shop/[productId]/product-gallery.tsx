"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { MediaLightbox } from "@/components/modals/media-lightbox";
import { GearIcon } from "@/components/shop/gear-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The listing's photos on a plain ground, never cropped, each angle
// numbered like a contact sheet (wave 2 Chợ F). Without photos: a dashed
// frame with the icon of what is missing and a way to ask the seller for
// real ones.
export function ProductGallery({
  images,
  name,
  category,
  askHref,
}: {
  images: { url: string }[];
  name: string;
  category: string;
  /** The seller's chat, or null for the seller themselves. */
  askHref: string | null;
}) {
  const t = useTranslations("publicPages.productDetail.v2");
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-[var(--fg-radius-lg)] border border-dashed border-border-strong bg-bg-sunken text-text-tertiary">
        <GearIcon category={category} className="size-16" />
        <span className="font-mono text-meta tracking-[0.12em] uppercase">
          {t("noPhoto")}
        </span>
        {askHref ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={askHref} />}
          >
            <MessageCircle aria-hidden className="size-4" />
            {t("askForPhotos")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        aria-label={t("openPhoto", { frame: activeIndex + 1 })}
        className="focus-ring relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[var(--fg-radius-lg)] bg-bg-sunken"
      >
        <Image
          src={images[activeIndex].url}
          alt={name}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-contain p-6"
        />
      </button>

      {images.length > 1 ? (
        <div className="grid grid-cols-5 gap-2.5">
          {images.map((img, index) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-pressed={index === activeIndex}
              className={cn(
                "focus-ring flex flex-col items-center rounded-[var(--fg-radius-sm)] border bg-bg-sunken p-1.5",
                index === activeIndex
                  ? "border-text-primary"
                  : "border-transparent hover:border-border-strong",
              )}
            >
              <span className="relative block aspect-square w-full">
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-contain"
                />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {lightboxOpen ? (
        <MediaLightbox
          items={images.map((img) => ({
            url: img.url,
            type: "IMAGE" as const,
          }))}
          index={activeIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setActiveIndex}
          title={name}
        />
      ) : null}
    </div>
  );
}
