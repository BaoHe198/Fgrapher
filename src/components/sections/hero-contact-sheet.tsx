"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { buildMediaVariants } from "@/lib/media-variants";

export interface HeroPhoto {
  url: string;
  alt: string;
}

// The four frames keep the original mosaic's staggered heights — the
// offset column is what stops it reading as a plain grid.
const FRAMES = [
  { height: 200, column: 0 },
  { height: 140, column: 0 },
  { height: 150, column: 1 },
  { height: 190, column: 1 },
] as const;

const REVEAL_STAGGER_MS = 120;
const FIRST_SWAP_DELAY_MS = 4500;
const SWAP_INTERVAL_MS = 6000;

/**
 * The landing hero, as a photographer's contact sheet.
 *
 * Two deliberate constraints, both there to keep this from turning into a
 * carousel — which is what this becomes if you let it run freely:
 *
 *  1. Only ONE frame changes at a time. Four frames sliding together is a
 *     slideshow; one frame quietly becoming a different photograph reads
 *     as a window onto work in progress.
 *  2. It stops. Each frame changes exactly once, then the sheet is still
 *     for good. This sits directly above the search box, and something
 *     blinking forever next to the one control on the page people came to
 *     use is a distraction, not an attraction.
 *
 * Motion is skipped entirely under prefers-reduced-motion: the global rule
 * in globals.css collapses the CSS transitions, but the swap is driven by
 * JavaScript and has to opt out on its own.
 */
export function HeroContactSheet({ photos }: { photos: HeroPhoto[] }) {
  // Frame i shows photos[i] first, and photos[i + 4] once it has swapped.
  const [swapped, setSwapped] = useState<boolean[]>([
    false,
    false,
    false,
    false,
  ]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hasSecondSet = photos.length >= FRAMES.length * 2;

  // The reveal is a pure CSS animation (animate-develop in globals.css),
  // not state: it has to run exactly once on mount, and driving it from an
  // effect would mean a synchronous setState there — a cascading render
  // for something CSS does on its own.
  useEffect(() => {
    if (!hasSecondSet) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const scheduled = timers.current;
    FRAMES.forEach((_, i) => {
      scheduled.push(
        setTimeout(
          () =>
            setSwapped((prev) => {
              const next = [...prev];
              next[i] = true;
              return next;
            }),
          FIRST_SWAP_DELAY_MS + i * SWAP_INTERVAL_MS,
        ),
      );
    });

    return () => {
      scheduled.forEach(clearTimeout);
      scheduled.length = 0;
    };
  }, [hasSecondSet]);

  const columns = [0, 1].map((col) =>
    FRAMES.map((frame, i) => ({ ...frame, index: i })).filter(
      (frame) => frame.column === col,
    ),
  );

  return (
    <div className="grid grid-cols-2 gap-3 max-lg:hidden">
      {columns.map((frames, col) => (
        <div
          key={col}
          className={
            col === 1 ? "flex flex-col gap-3 pt-[34px]" : "flex flex-col gap-3"
          }
        >
          {frames.map((frame) => {
            const first = photos[frame.index];
            const second = photos[frame.index + FRAMES.length];
            if (!first) return null;
            const showSecond = Boolean(second) && swapped[frame.index];

            return (
              <div
                key={frame.index}
                className="relative overflow-hidden rounded-2xl bg-green-950"
                style={{ height: frame.height }}
              >
                {[first, second].map((photo, layer) => {
                  if (!photo) return null;
                  const isVisible = layer === 0 ? !showSecond : showSecond;
                  return (
                    <Image
                      key={photo.url}
                      src={buildMediaVariants(photo.url).medium}
                      alt={layer === 0 ? photo.alt : ""}
                      fill
                      sizes="(min-width: 1024px) 300px, 0px"
                      // A photograph appearing rather than sliding in:
                      // it arrives slightly desaturated and lifts to full
                      // contrast, the way a print comes up in a tray.
                      className={
                        layer === 0
                          ? "animate-develop object-cover transition-opacity duration-[900ms] ease-out"
                          : "object-cover transition-opacity duration-[900ms] ease-out"
                      }
                      style={{
                        // Bias the crop toward the upper third. These are
                        // whatever photographs providers uploaded, not art
                        // directed for this grid, and object-cover's default
                        // centre crop lands on a chin or a torso far more
                        // often than on a face. Cannot be solved properly
                        // without subject detection; this is the heuristic
                        // that costs nothing.
                        objectPosition: "center 30%",
                        opacity: isVisible ? 1 : 0,
                        animationDelay:
                          layer === 0
                            ? `${frame.index * REVEAL_STAGGER_MS}ms`
                            : undefined,
                      }}
                      priority={layer === 0 && frame.index === 0}
                      unoptimized
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
