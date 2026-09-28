/**
 * Pure helpers behind every URL-driven filter panel (/browse, /shop).
 *
 * The bug they exist to prevent (QA-01 and QA-02, 22/09/2026): each filter
 * control used to rebuild the query string from `useSearchParams()`, i.e.
 * from the URL the browser has *committed*. Two problems came out of that:
 *
 *  - /browse's sidebar built its query from a `FilterState` object that has
 *    no `q` field at all, so every filter click silently dropped the search
 *    keyword. Searching "Thanh", then ticking a role, went from 2 results
 *    back to 8 with an empty search box — which reads as "the filter did
 *    nothing".
 *  - /shop's controls each read the committed URL, so a second control
 *    touched within the same navigation (blur-then-click is one gesture for
 *    a person) built on a URL that did not have the first one's change yet
 *    and overwrote it. Non-deterministic by construction: whether the
 *    keyword survived depended on whether the first navigation had landed.
 *
 * The fix both share: build every new query from the *latest intent* rather
 * than from the committed URL, and only ever add/remove the keys the control
 * actually owns.
 */

/**
 * Applies one control's change on top of `current` (the latest intended
 * query string, not necessarily the one in the address bar yet).
 *
 * `page` is always dropped: changing any filter invalidates the offset the
 * customer was at, and keeping it strands them on an empty page 3.
 */
export function nextFilterQuery(
  current: string,
  mutate: (params: URLSearchParams) => void,
): string {
  const params = new URLSearchParams(current);
  mutate(params);
  params.delete("page");
  return params.toString();
}

/**
 * Order-insensitive comparison of two query strings.
 *
 * Needed because a navigation we caused and a navigation the visitor caused
 * (back/forward, a link) have to be told apart, and the only evidence is the
 * query string — which round-trips through Next.js with its keys in whatever
 * order the pushing component happened to set them.
 */
export function isSameFilterQuery(a: string, b: string): boolean {
  const left = new URLSearchParams(a);
  const right = new URLSearchParams(b);
  left.sort();
  right.sort();
  return left.toString() === right.toString();
}

/**
 * Writes one filter key, deleting it when the value is empty — the shape
 * every control here wants, since an absent key and an empty value mean the
 * same thing to the server components reading `searchParams`.
 */
export function setOrDelete(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
): void {
  if (value) params.set(key, value);
  else params.delete(key);
}
