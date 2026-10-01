"use client";

import { type RefObject, useEffect, useState } from "react";

// True while a Phòng tối section sits under (or touches) the header - the
// sticky header uses it to switch to the darkroom surface as its bottom
// edge meets a dark block (wave 2 kit §01-B), and a page that opens on
// Phòng tối gets a dark header from the first frame. The band is measured
// from the header itself, so a banner above it doesn't throw it off.
// Colour only: the header never moves or changes height.
export function useDarkroomUnder(
  headerRef: RefObject<HTMLElement | null>,
  key: string,
): boolean {
  const [under, setUnder] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
    // 2px past the header's bottom, so a block starting right under it
    // counts as being under it.
    const band = () =>
      (headerRef.current?.getBoundingClientRect().bottom ?? 72) + 2;
    let observer: IntersectionObserver | null = null;

    const connect = () => {
      observer?.disconnect();
      visible.clear();
      const targets = document.querySelectorAll(
        'main [data-surface="darkroom"][data-under-header]',
      );
      if (targets.length === 0) {
        setUnder(false);
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target);
            else visible.delete(entry.target);
          }
          setUnder(visible.size > 0);
        },
        // Only the strip directly beneath the header counts.
        {
          rootMargin: `0px 0px -${Math.max(0, window.innerHeight - band())}px 0px`,
        },
      );
      targets.forEach((target) => observer!.observe(target));
    };

    connect();
    // Client components (feeds, albums) can mount their dark blocks later.
    let pending = 0;
    const mutations = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(connect, 120);
    });
    const main = document.querySelector("main");
    if (main) mutations.observe(main, { childList: true, subtree: true });
    window.addEventListener("resize", connect);
    // Something above the header (the environment banner, a cookie notice)
    // can appear after this ran and move the header down: measure again.
    let lastBottom = band();
    const layout =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const bottom = band();
            if (bottom === lastBottom) return;
            lastBottom = bottom;
            connect();
          });
    layout?.observe(document.body);
    return () => {
      observer?.disconnect();
      layout?.disconnect();
      mutations.disconnect();
      window.clearTimeout(pending);
      window.removeEventListener("resize", connect);
    };
  }, [headerRef, key]);

  return under;
}
