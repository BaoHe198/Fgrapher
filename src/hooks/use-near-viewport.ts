"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A ref for an element, and whether that element has come within `margin`
 * of the screen yet. Once true it stays true.
 *
 * For something heavy that sits far down a page — the small map on a
 * profile or a photo spot, most of all. Loaded with the page, that map cost
 * every visitor the map engine (about 280 KB of script), its style, its
 * fonts and its tiles, and several seconds of a slow phone's processor,
 * whether or not they ever scrolled to it. With this the placeholder holds
 * the room and the real thing starts when the visitor is about a screen
 * away.
 *
 * `margin` is an IntersectionObserver root margin for top and bottom: a
 * percentage is of the screen's height, so the default is "one screen away".
 */
export function useNearViewport<T extends Element>(margin = "100%") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // No observer (a very old browser): load it rather than never show it.
    if (typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: `${margin} 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [margin]);

  return [ref, near] as const;
}
