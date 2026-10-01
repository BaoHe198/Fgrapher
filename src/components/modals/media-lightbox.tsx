"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { type MediaKind, mediaKindFromUrl } from "@/lib/media/kind";
import { buildMediaVariants } from "@/lib/media/variants";

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
  /**
   * The thumbnail each photo was opened from. When given, the photo flies
   * from that tile into place and back (kit §05 B: transform only, which
   * works because neither the grid nor the lightbox crops).
   */
  originFor?: (index: number) => HTMLElement | null;
  /** Buttons under the caption, e.g. "Xem hồ sơ" / "Đặt lịch" in Theo ảnh. */
  actions?: React.ReactNode;
}

const subscribeNoop = () => () => {};
const OPEN_MS = 280;
const CLOSE_MS = 260;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The transform that puts `to` exactly over `from`. Both keep the photo's
// own ratio, so a uniform scale from the top-left corner is enough.
function flipFrom(from: DOMRect, to: DOMRect) {
  const scale = from.width / to.width;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`;
}

function inViewport(rect: DOMRect) {
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

// Viewing photos happens in Phòng tối (darkroom kit §01): the backdrop is
// the darkroom ground, not a black wash, whatever theme the page is in.
export function MediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
  title,
  description,
  categoryLabel,
  originFor,
  actions,
}: MediaLightboxProps) {
  const t = useTranslations("sharedComponents.mediaLightbox");
  const rootRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const next = useCallback(
    () => onIndexChange((index + 1) % items.length),
    [index, items.length, onIndexChange],
  );
  const previous = useCallback(
    () => onIndexChange((index - 1 + items.length) % items.length),
    [index, items.length, onIndexChange],
  );

  // Close runs the open in reverse when the tile is still on screen, a
  // 200ms fade in place when it scrolled away, and nothing when the
  // viewer asked for less motion.
  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const root = rootRef.current;
    const media = mediaRef.current;
    if (!root || !media || prefersReducedMotion()) {
      onClose();
      return;
    }
    const origin = originFor?.(index)?.getBoundingClientRect();
    const fly = origin && origin.width > 0 && inViewport(origin);
    root.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: fly ? CLOSE_MS : 200,
      easing: EASE_OUT,
      fill: "forwards",
    });
    const done = fly
      ? media.animate(
          [
            { transform: "none" },
            { transform: flipFrom(origin, media.getBoundingClientRect()) },
          ],
          { duration: CLOSE_MS, easing: EASE_OUT, fill: "forwards" },
        ).finished
      : new Promise((resolve) => setTimeout(resolve, 200));
    done.then(onClose, onClose);
  }, [index, onClose, originFor]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, requestClose]);

  // Opening: the backdrop fills in while the photo grows from its tile.
  // Runs once - later photos simply replace the current one.
  useLayoutEffect(() => {
    if (!isClient) return;
    closeRef.current?.focus({ preventScroll: true });
    const root = rootRef.current;
    const media = mediaRef.current;
    if (!root || !media || prefersReducedMotion()) return;
    const origin = originFor?.(index)?.getBoundingClientRect();
    root.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: origin ? 180 : 200,
      easing: EASE_OUT,
    });
    if (!origin || origin.width === 0) return;
    media.style.willChange = "transform";
    const anim = media.animate(
      [
        { transform: flipFrom(origin, media.getBoundingClientRect()) },
        { transform: "none" },
      ],
      { duration: OPEN_MS, easing: EASE_OUT },
    );
    const clear = () => {
      media.style.willChange = "";
    };
    anim.finished.then(clear, clear);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open only
  }, [isClient]);

  // Phones swipe sideways between photos and down (past 120px) to close.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (dy > 120 && Math.abs(dy) > Math.abs(dx)) {
      requestClose();
      return;
    }
    if (items.length < 2 || Math.abs(dx) < 40) return;
    if (dx < 0) next();
    else previous();
  };

  const current = items[index];
  if (!current || !isClient) return null;

  const frame = (n: number) => String(n).padStart(2, "0");
  const caption = [
    t("frame", { current: frame(index + 1), total: frame(items.length) }),
    title,
    categoryLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const control =
    "focus-ring absolute z-10 flex size-11 items-center justify-center rounded-full border border-dr-line-2 bg-dr-surface text-dr-text transition-colors duration-[var(--fg-dur-150)] hover:bg-dr-raised";

  // Rendered into document.body. Opened from inside a card (Cộng đồng F's
  // post), `fixed inset-0` was held to the card by its clipping/transform
  // context: the "full-screen" viewer sat inside the post with the page
  // showing around it and its left arrow cut off (24–25/09 reports).
  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? t("label")}
      data-surface="darkroom"
      className="fixed inset-0 z-50 flex flex-col bg-dr-bg text-dr-text"
      onClick={requestClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          requestClose();
        }}
        aria-label={t("close")}
        className={`${control} top-4 right-4 sm:top-5 sm:right-5`}
      >
        <X className="size-5" />
      </button>

      <div className="flex min-h-0 flex-1 items-center justify-center px-16 pt-16 pb-4 max-sm:px-3">
        <div
          ref={mediaRef}
          className="relative max-h-full origin-top-left"
          onClick={(e) => e.stopPropagation()}
        >
          {(current.type ?? mediaKindFromUrl(current.url)) === "VIDEO" ? (
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
              className="max-h-[calc(100dvh-11rem)] max-w-full bg-dr-bg"
            />
          ) : (
            <Image
              key={current.url}
              src={buildMediaVariants(current.url).large}
              alt={current.title ?? ""}
              width={1200}
              height={800}
              unoptimized
              className="max-h-[calc(100dvh-11rem)] w-auto max-w-full object-contain shadow-[0_0_0_1px_var(--dr-line)]"
            />
          )}
        </div>
      </div>

      {items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              previous();
            }}
            aria-label={t("previous")}
            className={`${control} top-1/2 left-3 -translate-y-1/2 sm:left-5`}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label={t("next")}
            className={`${control} top-1/2 right-3 -translate-y-1/2 sm:right-5`}
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      ) : null}

      <div
        className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-dr-line px-4 py-4 sm:px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p
            aria-live="polite"
            className="font-mono text-meta tracking-[0.12em] text-dr-text-2 uppercase"
          >
            {caption}
          </p>
          {current.title && current.title !== title ? (
            <p className="mt-1 text-body-sm text-dr-text">{current.title}</p>
          ) : null}
          {description ? (
            <p className="mt-1 line-clamp-2 max-w-2xl text-body-sm text-dr-text-3">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
