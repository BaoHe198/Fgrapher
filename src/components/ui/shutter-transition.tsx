"use client";

import * as React from "react";

// The shutter (owner, 16/11/2026): pressing a photo link that carries
// `data-shutter` closes and reopens two blades over the page, like the
// frame being taken, while the navigation it started carries on
// underneath. It never delays or blocks the navigation, plays only for a
// plain left click, and is skipped under reduced motion.
export function ShutterTransition() {
  const [shot, setShot] = React.useState(0);

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Capture phase, and no defaultPrevented check: next/link prevents
      // the default itself to navigate client-side, so by the time the
      // click bubbles here it always reads as "handled".
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target as Element | null;
      if (!target?.closest?.("a[data-shutter]")) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setShot((count) => count + 1);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (shot === 0) return null;
  return (
    <div
      // A new key restarts the animation for every press.
      key={shot}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
      onAnimationEnd={(event) => {
        if (event.animationName === "fg-shutter-bottom") setShot(0);
      }}
    >
      <span className="absolute inset-x-0 top-0 h-1/2 animate-shutter-top bg-black" />
      <span className="absolute inset-x-0 bottom-0 h-1/2 animate-shutter-bottom bg-black" />
    </div>
  );
}
