"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

interface MediaLightboxProps {
  items: { url: string; title?: string | null }[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function MediaLightbox({ items, index, onClose, onIndexChange }: MediaLightboxProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % items.length);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + items.length) % items.length);
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
        aria-label="Close"
        className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <X className="size-5" />
      </button>

      {items.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + items.length) % items.length);
          }}
          aria-label="Previous"
          className="absolute left-5 flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}

      <div
        className="relative max-h-[85vh] max-w-[85vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={current.url}
          alt={current.title ?? ""}
          width={1200}
          height={800}
          unoptimized
          className="max-h-[85vh] w-auto rounded-lg object-contain"
        />
      </div>

      {items.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % items.length);
          }}
          aria-label="Next"
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
