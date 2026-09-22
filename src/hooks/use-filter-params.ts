"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  startTransition as startGlobalTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { isSameFilterQuery, nextFilterQuery } from "@/lib/filter-params";

export interface NavigateOptions {
  /**
   * Coalescing window before the router.push actually fires. The optimistic
   * params update immediately either way, so the control still feels
   * instant — this only batches the server round-trip (typing a word, or
   * ticking three roles in a row, is one navigation rather than one each).
   */
  debounceMs?: number;
}

export interface FilterParamsController {
  /**
   * The query the UI should render from. Optimistic: it reflects the most
   * recent intent straight away, even while the matching navigation is
   * still in flight, so a checkbox never appears to un-tick itself.
   */
  params: URLSearchParams;
  /** True while a navigation this controller started has not landed yet. */
  isPending: boolean;
  /** Applies one change on top of the latest intent and navigates. */
  navigate: (
    mutate: (params: URLSearchParams) => void,
    options?: NavigateOptions,
  ) => void;
  /** Clears every filter in one go. */
  reset: () => void;
}

/**
 * Single owner of a filter panel's query string.
 *
 * Every control on a page shares ONE of these (via context on /browse, or
 * directly in the one component that owns them on /shop) so that no two
 * controls can build competing query strings from a stale URL — see
 * lib/filter-params.ts for the failures that came from letting them.
 */
export function useFilterParams(): FilterParamsController {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(() => searchParams.toString());
  // Mirrors `query` synchronously — setState is batched and this is not, so
  // a second control touched in the same tick still reads the first one's
  // intent. Written only from event handlers and effects, never in render.
  const queryRef = useRef(query);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const committed = searchParams.toString();
    // Our own navigation landing — nothing to resync, and resyncing would
    // clobber any intent queued behind it.
    if (isSameFilterQuery(committed, queryRef.current)) return;
    // The URL moved for a reason we didn't cause: back/forward, or a link.
    // Anything we had queued is now stale, so drop it rather than letting
    // it fire on top of where the visitor just navigated to.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    queryRef.current = committed;
    startGlobalTransition(() => setQuery(committed));
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const push = useCallback(
    (nextQuery: string) => {
      startTransition(() => {
        router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router],
  );

  const navigate = useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      { debounceMs = 0 }: NavigateOptions = {},
    ) => {
      const nextQuery = nextFilterQuery(queryRef.current, mutate);
      queryRef.current = nextQuery;
      setQuery(nextQuery);

      if (timerRef.current) clearTimeout(timerRef.current);
      if (debounceMs > 0) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          push(nextQuery);
        }, debounceMs);
      } else {
        push(nextQuery);
      }
    },
    [push],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    queryRef.current = "";
    setQuery("");
    push("");
  }, [push]);

  // Not memoized: the React Compiler handles it, and nothing here depends
  // on the object's identity — every consumer either reads a value out of it
  // or mutates a fresh copy inside navigate().
  const params = new URLSearchParams(query);

  return { params, isPending, navigate, reset };
}
