"use client";

import { useEffect, useRef } from "react";

interface ProfileViewBeaconProps {
  profileId: string;
}

/**
 * Reports one profile view to POST /api/profiles/view after the page mounts.
 * Renders nothing.
 *
 * The counting used to happen inline in the profile page's Server Component,
 * which meant every refresh, back-button return, `?role=` tab switch and
 * crawler fetch added one. A Server Component can't set cookies, so it had no
 * way to remember it had already counted this visitor — hence a route handler
 * (which can) and this beacon to call it. The server does the deduplication;
 * this component's only job is to fire exactly once per mounted profile.
 */
export function ProfileViewBeacon({ profileId }: ProfileViewBeaconProps) {
  // React 18+ mounts effects twice in development StrictMode, and the
  // server-side dedupe window would swallow the second call anyway — but only
  // after a database read. Cheaper to not send it.
  const reportedRef = useRef<string | null>(null);

  useEffect(() => {
    if (reportedRef.current === profileId) return;
    reportedRef.current = profileId;

    void fetch("/api/profiles/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
      // Survives the visitor navigating away immediately after the page
      // paints, which is exactly when a lot of real views happen.
      keepalive: true,
      // Nothing renders from the response; a failed count is not worth an
      // error in the console of a page that is otherwise fine.
    }).catch(() => {});
  }, [profileId]);

  return null;
}
