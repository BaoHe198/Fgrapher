"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOffIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Every photograph in the app (system audit 09/2026 §05). It holds its
// aspect ratio before the file arrives (a bg-sunken slot, so nothing
// jumps), "develops" once when the file has loaded AND 15% of it is on
// screen - fade, blur 6→0, saturation .3→1 in 400ms - and falls back to a
// quiet slot with an icon if the file fails. A hairline ring sits inside
// the frame so a photo does not glow against a dark page; the photo itself
// is never dimmed or filtered, because providers need customers to see
// their true colours.

type Ratio = "1/1" | "3/4" | "4/5" | "4/3" | "3/2" | "16/9" | "2/3";

const RATIO_CLASS: Record<Ratio, string> = {
  "1/1": "aspect-square",
  "3/4": "aspect-[3/4]",
  "4/5": "aspect-[4/5]",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-video",
  "2/3": "aspect-[2/3]",
};

// 60ms stagger steps, capped at six photos (audit §03).
const STAGGER_CLASS = [
  "",
  "[animation-delay:60ms]",
  "[animation-delay:120ms]",
  "[animation-delay:180ms]",
  "[animation-delay:240ms]",
  "[animation-delay:300ms]",
];

const ROUNDED_CLASS = {
  none: "rounded-none",
  sm: "rounded-[var(--fg-radius-sm)]",
  md: "rounded-[var(--fg-radius-md)]",
  lg: "rounded-[var(--fg-radius-lg)]",
  full: "rounded-full",
} as const;

interface FgImageProps {
  src: string | null | undefined;
  alt: string;
  /** Box ratio. Omit to fill a parent that already has a size. */
  ratio?: Ratio;
  rounded?: keyof typeof ROUNDED_CLASS;
  /** Above-the-fold image: loads eagerly and skips the develop reveal. */
  priority?: boolean;
  /** Set false to show the photo without the develop effect. */
  reveal?: boolean;
  /** Stagger index inside a grid; 60ms steps, capped at six. */
  revealIndex?: number;
  sizes?: string;
  className?: string;
  imageClassName?: string;
  /** Overlay content (labels, frame numbers) drawn over the photo. */
  children?: React.ReactNode;
}

function FgImage({
  src,
  alt,
  ratio,
  rounded = "sm",
  priority = false,
  reveal = true,
  revealIndex = 0,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  className,
  imageClassName,
  children,
}: FgImageProps) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const [inView, setInView] = React.useState(!reveal || priority);
  const failed = !src || failedSrc === src;

  React.useEffect(() => {
    if (inView) return;
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  const develop = reveal && !priority;
  const shown = loaded && inView;

  return (
    <div
      ref={frameRef}
      data-slot="fg-image"
      data-state={failed ? "error" : loaded ? "loaded" : "loading"}
      className={cn(
        "relative isolate overflow-hidden bg-bg-sunken",
        ratio ? RATIO_CLASS[ratio] : "size-full",
        ROUNDED_CLASS[rounded],
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_var(--fg-image-ring)]",
        className,
      )}
    >
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center text-text-tertiary">
          <ImageOffIcon aria-hidden className="size-6" />
          <span className="sr-only">{alt}</span>
        </span>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          onLoad={() => setLoaded(true)}
          onError={() => setFailedSrc(src)}
          className={cn(
            "object-cover",
            develop &&
              (shown
                ? cn("animate-develop", STAGGER_CLASS[Math.min(revealIndex, 5)])
                : "opacity-0"),
            imageClassName,
          )}
        />
      )}
      {children}
    </div>
  );
}

export { FgImage };
export type { FgImageProps };
