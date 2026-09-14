"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect } from "react";

import { type MediaKind, mediaKindFromUrl } from "@/lib/media-kind";
import { buildMediaVariants } from "@/lib/media-variants";

interface MediaLightboxProps {
  // `type` is optional: portfolio media carries its own, while reference
  // media (bookings, service requests) only ever stored a URL, so those
  // fall back to reading the kind from the URL itself.
  items: { url: string; title?: string | null; type?: MediaKind }[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  // Prompt G3, VIỆC 4 — the public album viewer needs to show the
  // album's own title/description/category, not just per-photo captions.
  // Optional so the product-gallery and chat-panel callers (plain photo
  // sets with no album context) are unaffected.
  title?: string;
  description?: string | null;
  categoryLabel?: string;
}

export function MediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
  title,
  description,
  categoryLabel,
}: MediaLightboxProps) {
  const t = useTranslations("sharedComponents.mediaLightbox");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % items.length);
      if (e.key === "ArrowLeft")
        onIndexChange((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, items.length, onClose, onIndexChange]);

  const current = items[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <X className="size-5" />
      </button>

      {title ? (
        <div
          className="absolute top-5 left-5 max-w-[70vw] text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <p className="text-body-lg font-semibold!">{title}</p>
            {categoryLabel ? (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-body-sm">
                {categoryLabel}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 text-body-sm text-white/70">{description}</p>
          ) : null}
        </div>
      ) : null}

      {items.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + items.length) % items.length);
          }}
          aria-label={t("previous")}
          className="absolute left-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}

      <div
        className="relative max-h-[85vh] max-w-[85vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {(current.type ?? mediaKindFromUrl(current.url)) === "VIDEO" ? (
          // This lightbox used to render every item as an <Image>. Portfolio
          // albums can contain videos, so opening one showed a broken image
          // — never noticed because CSP was also refusing to load Cloudinary
          // video at all (see media-src in next.config.ts).
          //
          // The raw URL, not buildMediaVariants(): those variants append
          // f_webp, which turns a video into a failed image request.
          // key={url} remounts the element when navigating between two
          // videos, so the previous one doesn't keep playing underneath.
          <video
            key={current.url}
            src={current.url}
            controls
            autoPlay
            playsInline
            className="max-h-[85vh] max-w-[85vw] rounded-lg bg-black"
          />
        ) : (
          <Image
            src={buildMediaVariants(current.url).large}
            alt={current.title ?? ""}
            width={1200}
            height={800}
            unoptimized
            className="max-h-[85vh] w-auto rounded-lg object-contain"
          />
        )}
      </div>

      {items.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % items.length);
          }}
          aria-label={t("next")}
          className="absolute right-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <ChevronRight className="size-5" />
        </button>
      ) : null}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-body-sm text-white">
        {index + 1} / {items.length}
      </div>
    </div>
  );
}
