// Pure cache-policy primitives — tag names, TTLs, Cache-Control strings and
// the Date reviver. No imports (no `next/cache`, no `db`), so this is unit-
// testable in isolation, the same reason services/email-outbox-policy.ts is
// kept separate. The runtime helpers that call revalidateTag / unstable_cache
// live in lib/cache.ts and re-export everything here.

/** Coarse, app-wide tags. Per-entity tags are built by the helpers below. */
export const CACHE_TAGS = {
  /** All Province / Ward reference data. */
  geography: "geography",
  /** Global search results, facet counts, and the featured-profiles strip. */
  search: "search",
} as const;

/** Tag for one public profile page, keyed by username (what the page is keyed by). */
export const profileNameTag = (username: string) =>
  `profile:name:${username.toLowerCase()}`;

/** Tag for a provider's per-user public reads (reviews, review stats, shop). */
export const profileUserTag = (userId: string) => `profile:user:${userId}`;

/** Revalidate seconds per cached read. Kept together so the policy is legible. */
export const CACHE_TTL = {
  /**
   * Geography (Province / Ward). Changes only via a seed / migration, which
   * is followed by a redeploy that drops the whole Data Cache anyway — see
   * the note in services/geography.ts.
   */
  geography: 60 * 60 * 24, // 24h
  /** Landing-page "featured" strip — its own function, its own cache. */
  featured: 60 * 10, // 10m
  /**
   * Public search result pages. The global facet counts returned alongside
   * are computed inside searchProfiles and so ride this same ~90s window —
   * deliberately (fresher than the "few minutes" they could tolerate;
   * splitting them out cleanly would mean nesting unstable_cache or
   * reshaping the search return type, neither warranted here).
   */
  search: 90, // ~90s
  /** Public profile page + its per-user reads. */
  publicProfile: 90, // ~90s
} as const;

// -----------------------------------------------------------------------------
// Cache-Control header values for the public JSON APIs. Applied to 200s only —
// never to errors or to anything behind auth.
// -----------------------------------------------------------------------------

/** Geography APIs: rarely changes, safe to let a CDN hold it for a day. */
export const GEOGRAPHY_CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400";

/** Public search API: brief shared cache, revalidate in the background. */
export const PUBLIC_SEARCH_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=120";

// -----------------------------------------------------------------------------
// Date rehydration.
//
// `unstable_cache` persists results with `JSON.stringify` and returns them with
// `JSON.parse`, so on a cache *hit* every `Date` comes back as an ISO string.
// Cached reads whose result flows into code calling Date methods (`getFullYear`,
// `toISOString`, …) must be run back through this.
//
// Two shapes reach this function:
//   - cache MISS: the raw service result, with real `Date` objects — returned
//     untouched;
//   - cache HIT:  the JSON-parsed shape, with ISO strings where Dates were —
//     the strings at timestamp-looking keys become `Date` again.
//
// The walk only ever recurses into plain objects and arrays. Anything else —
// `Date` above all, but also any other class instance (a hypothetical Prisma
// `Decimal`, a `Buffer`) — is passed straight through: `Object.entries(new
// Date())` is `[]`, so walking it would silently replace the value with `{}`.
// Conversion is keyed on the field name, never on the string's shape alone, so
// a real string field is never turned into a Date.
//
// The Prisma models behind every cached read here use `Float`/`Int` for money
// and ratings (no `Decimal`) and none of the selected columns are `Json`, so
// `Date` is in practice the only non-plain value — but non-plain values are
// preserved rather than walked, so this stays correct if that changes.
// -----------------------------------------------------------------------------

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const DATE_KEY_RE = /(?:^|[a-z])At$|^dateOfBirth$|^emailVerified$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function reviveDates<T>(value: T): T {
  return revive(value) as T;
}

function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  // Date (cache-miss path) and every other non-plain object: pass through.
  if (!isPlainObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === "string" && DATE_KEY_RE.test(key) && ISO_DATE_RE.test(v)) {
      out[key] = new Date(v);
    } else {
      out[key] = revive(v);
    }
  }
  return out;
}
