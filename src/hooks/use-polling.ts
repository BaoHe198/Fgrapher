"use client";

import { useEffect, useRef } from "react";

import { canPoll, shouldCatchUp, type PollGate } from "@/hooks/polling-policy";

/**
 * The one polling primitive for the app. Every interval-driven refresh
 * (messages, conversation lists, unread badges, the notification bell) goes
 * through this instead of its own `setInterval`.
 *
 * It gives three things a bare interval does not:
 *
 *  - **Pauses when nobody is looking.** Runs only while the tab is visible and
 *    the caller says it is wanted. A backgrounded tab stops costing requests
 *    and database work entirely.
 *  - **Never overlaps.** The next run is scheduled after the previous one
 *    settles, not on a fixed grid, so two requests for the same data are never
 *    in flight together and a slow response cannot land after a newer one.
 *  - **Catches up instantly on resume.** Coming back to the tab (or re-enabling
 *    the poller) refreshes straight away rather than waiting out an interval,
 *    so the user never stares at data frozen since they left.
 *
 * The rules live in hooks/polling-policy.ts; this is only the wiring.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  {
    intervalMs,
    enabled = true,
    resetKey,
    skipInitialRun = false,
  }: {
    intervalMs: number;
    /** False pauses the poller entirely (panel closed, minimized, hidden). */
    enabled?: boolean;
    /**
     * Changing this restarts the schedule and fetches immediately — for when
     * the callback starts pointing at different data (a new conversation id).
     * Without it the caller would have to fire its own extra request and race
     * the one already scheduled.
     */
    resetKey?: string | number | null;
    /**
     * Skip only the very first run. For callers whose initial data already
     * arrived with the server-rendered page — fetching on mount would just
     * re-request what is already on screen. Resumes and resetKey changes
     * still fetch immediately.
     */
    skipInitialRun?: boolean;
  },
) {
  // Kept in a ref so a fresh closure each render doesn't restart the schedule
  // — callers pass inline arrows and should not have to memoize. Synced in an
  // effect, not during render: writing a ref while rendering is what
  // react-hooks/refs forbids, and this runs before the polling effect below
  // either way (effects fire in declaration order).
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Consumed once, and lives outside the polling effect so re-running that
  // effect (enable, resetKey) still fetches immediately.
  const initialRunPendingRef = useRef(skipInitialRun);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const gate: PollGate = {
      enabled,
      visible: document.visibilityState === "visible",
      inFlight: false,
    };

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNext = () => {
      clearTimer();
      if (cancelled || !gate.enabled) return;
      timer = setTimeout(run, intervalMs);
    };

    const run = async () => {
      if (cancelled || !canPoll(gate)) return;
      gate.inFlight = true;
      try {
        await callbackRef.current();
      } catch {
        // A failed poll must never kill the schedule — the next tick retries.
        // Individual callers surface their own errors if they care.
      } finally {
        gate.inFlight = false;
        scheduleNext();
      }
    };

    const onVisibilityChange = () => {
      const prev = { ...gate };
      gate.visible = document.visibilityState === "visible";
      if (shouldCatchUp(prev, gate)) {
        void run();
      } else if (!gate.visible) {
        // Stop the clock while hidden; returning re-arms it through run().
        clearTimer();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    // Mount, every enable, and every resetKey change count as a catch-up:
    // there is nothing on screen yet, or what is there predates the poller
    // being switched on / pointed somewhere new.
    if (initialRunPendingRef.current) {
      initialRunPendingRef.current = false;
      scheduleNext();
    } else {
      void run();
    }

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs, resetKey]);
}
