"use client";

import { useEffect, useState } from "react";

/**
 * False on the first render, true once the browser has had an idle moment
 * after the page became interactive (or after `timeoutMs`, whichever comes
 * first).
 *
 * For starting heavy work that is not needed to paint the page — the map
 * engine on Bản đồ F, most of all — after the page's own controls are on
 * screen and responding, instead of in competition with them.
 *
 * Safari has no requestIdleCallback; there a short timer stands in.
 */
export function useIdleReady(timeoutMs = 2000) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => setReady(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: timeoutMs });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(start, 300);
    return () => window.clearTimeout(id);
  }, [timeoutMs]);

  return ready;
}
