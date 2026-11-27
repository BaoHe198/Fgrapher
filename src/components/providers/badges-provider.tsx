"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CART_CHANGED_EVENT } from "@/hooks/use-cart";
import { usePolling } from "@/hooks/use-polling";

interface Badges {
  /** Conversations with at least one unread message. */
  unreadMessages: number;
  unreadNotifications: number;
  /** Units in the cart; always 0 while the marketplace is switched off. */
  cartItems: number;
}

interface BadgesContextValue extends Badges {
  /** Ask the server again now, after something that changes a number. */
  refresh: () => void;
  /**
   * Show a new unread-notification count straight away (a notification was
   * just opened, or all were marked read). The next refresh confirms it.
   */
  setUnreadNotifications: (
    next: number | ((current: number) => number),
  ) => void;
}

const NONE: Badges = {
  unreadMessages: 0,
  unreadNotifications: 0,
  cartItems: 0,
};

const BadgesContext = createContext<BadgesContextValue | null>(null);

export function useBadges() {
  const ctx = useContext(BadgesContext);
  if (!ctx) {
    throw new Error("useBadges must be used within BadgesProvider");
  }
  return ctx;
}

// The numbers on the header's message, bell and cart icons, from one request
// (/api/users/me/badges) on one schedule.
//
// Until 27/11/2026 each icon fetched its own: every signed-in page load sent
// three requests after rendering, each with its own sign-in check on the
// server, and the cart one downloaded the whole cart to print one number.
// Same cadence the message badge had (20s, paused in a hidden tab — see
// usePolling); the bell used to refresh every 30s, so it is now slightly
// fresher, not staler.
export function BadgesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const [badges, setBadges] = useState<Badges>(NONE);

  const load = useCallback(() => {
    if (!authenticated) return;
    return (
      fetch("/api/users/me/badges")
        .then((res) => res.json())
        .then((body) => {
          const data = body.data;
          if (!data) return;
          startTransition(() =>
            setBadges({
              unreadMessages: data.unreadMessages ?? 0,
              unreadNotifications: data.unreadNotifications ?? 0,
              cartItems: data.cartItems ?? 0,
            }),
          );
        })
        // A failed refresh keeps the last numbers; the next one tries again.
        .catch(() => {})
    );
  }, [authenticated]);

  usePolling(load, { intervalMs: 20_000, enabled: authenticated });

  // Anything that changes the cart announces it (see hooks/use-cart.ts), so
  // the icon follows without waiting for the next poll.
  useEffect(() => {
    if (!authenticated) return;
    const onCartChanged = () => {
      load();
    };
    window.addEventListener(CART_CHANGED_EVENT, onCartChanged);
    return () => window.removeEventListener(CART_CHANGED_EVENT, onCartChanged);
  }, [authenticated, load]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  const setUnreadNotifications = useCallback(
    (next: number | ((current: number) => number)) => {
      startTransition(() =>
        setBadges((prev) => ({
          ...prev,
          unreadNotifications: Math.max(
            0,
            typeof next === "function" ? next(prev.unreadNotifications) : next,
          ),
        })),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      // Signed out (or just signed out): no numbers, whatever was last loaded.
      ...(authenticated ? badges : NONE),
      refresh,
      setUnreadNotifications,
    }),
    [authenticated, badges, refresh, setUnreadNotifications],
  );

  return (
    <BadgesContext.Provider value={value}>{children}</BadgesContext.Provider>
  );
}
