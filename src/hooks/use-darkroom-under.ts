"use client";

import { useEffect, useState } from "react";

// True while a Phòng tối section sits under the top `band` pixels of the
// viewport - the sticky header uses it to switch to the darkroom surface
// as its bottom edge meets a dark block (wave 2 kit §01-B). Colour only:
// the header never moves or changes height.
export function useDarkroomUnder(band: number, key: string): boolean {
  const [under, setUnder] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Set<Element>();
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
          rootMargin: `0px 0px -${Math.max(0, window.innerHeight - band)}px 0px`,
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
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      window.clearTimeout(pending);
      window.removeEventListener("resize", connect);
    };
  }, [band, key]);

  return under;
}
