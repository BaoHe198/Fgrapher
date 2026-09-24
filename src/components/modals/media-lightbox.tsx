"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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

const subscribeNoop = () => () => {};

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

  // Phones swipe between photos; the arrows alone were the only way, and
  // the left one was painted under the image (24/09 report).
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || items.length < 2) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    onIndexChange(
      delta < 0
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length,
    );
  };

  // Rendered into document.body. Opened from inside a card (Cộng đồng F's
  // post), `fixed inset-0` was held to the card by its clipping/transform
  // context: the "full-screen" viewer sat inside the post with the page
  // showing around it and its left arrow cut off (24–25/09 reports).
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const current = items[index];
  if (!current || !isClient) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("close")}
        className="absolute top-5 right-5 z-10 flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white"
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
          className="absolute left-3 z-10 flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white sm:left-5"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}

      <div
        className="relative max-h-[85vh] max-w-[calc(100vw-7rem)] sm:max-w-[85vw]"
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
            className="max-h-[85vh] max-w-full rounded-lg bg-black"
          />
        ) : (
          <Image
            src={buildMediaVariants(current.url).large}
            alt={current.title ?? ""}
            width={1200}
            height={800}
            unoptimized
            className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
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
          className="absolute right-3 z-10 flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white sm:right-5"
        >
          <ChevronRight className="size-5" />
        </button>
      ) : null}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-body-sm text-white">
        {index + 1} / {items.length}
      </div>
    </div>,
    document.body,
  );
}
