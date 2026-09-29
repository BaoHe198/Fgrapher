"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Section headings only (system audit 09/2026 §03): fade + rise 12px in
// 320ms, once, the first time the heading scrolls into view. Body text and
// buttons never animate in - only photos "develop" and only headings rise,
// so motion stays a signature. Content is visible before hydration and
// under reduced motion; the effect only ever hides something it is about
// to reveal.
export function RiseOnView({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<"idle" | "waiting" | "shown">(
    "idle",
  );

  React.useEffect(() => {
    const node = ref.current;
    if (
      !node ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // Already on screen at load: leave it alone rather than blink it.
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    React.startTransition(() => setState("waiting"));
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        state === "waiting" && "opacity-0",
        state === "shown" && "animate-rise",
        className,
      )}
    >
      {children}
    </div>
  );
}
