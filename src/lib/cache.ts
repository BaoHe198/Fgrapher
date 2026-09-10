import { revalidateTag, unstable_cache } from "next/cache";

import { CACHE_TAGS, profileNameTag, profileUserTag } from "@/lib/cache-tags";
import { db } from "@/lib/db";

// -----------------------------------------------------------------------------
// Fgrapher Data Cache — PUBLIC data only.
//
// The supported (non-Cache-Components) pattern: `unstable_cache` for reads,
// tag-based `revalidateTag` for on-demand invalidation from mutations.
// `cacheComponents` is deliberately NOT enabled — that is a larger, app-wide
// rendering change; this is scoped to measured Data-Cache wins on the
// anonymous read paths.
//
// NEVER wrap a read that depends on the session, cookies, headers, or any
// per-user state in these helpers. Everything cached here is identical for
// every visitor (published profiles, search facets, administrative geography).
// Dashboard / messaging / notifications / admin / booking-availability reads
// are intentionally left uncached.
//
// Pure primitives (tag names, TTLs, Cache-Control strings, reviveDates) live
// in lib/cache-tags.ts and are re-exported here.
// -----------------------------------------------------------------------------

export * from "@/lib/cache-tags";
export { unstable_cache };

// `revalidateTag` in Next 16 takes a required second argument.
//
// We pass `{ expire: 0 }` (immediate expiry), NOT the docs' default `"max"`
// (stale-while-revalidate). Every caller of these helpers is a mutation that
// can *remove* something from public view — a profile unpublished, an account
// suspended or deleted, a photo rejected. Under `"max"` the next visitor is
// served the stale "still visible" entry while it refreshes in the background;
// for a visibility *removal* that stale response is a correctness/privacy bug.
// `{ expire: 0 }` makes the next request a blocking cache-miss that renders
// fresh. Profile-level mutations are infrequent enough that the lost SWR
// smoothing does not matter. `{ expire: 0 }` is also not the deprecated
// single-argument form, so it stays supported.
//
// Best-effort, and observable: a failed bump is logged, never swallowed
// silently and never allowed to fail the mutation that triggered it. The one
// expected failure is "no request-scoped cache store" — a mutation service
// reused from a CLI script/test, or a detached (`void`) call that outlived its
// request — where there is simply no Data Cache to invalidate.
function bumpTag(tag: string) {
  try {
    revalidateTag(tag, { expire: 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[cache] revalidateTag("${tag}") failed — cache may be stale`,
      {
        message,
      },
    );
  }
}

/**
 * Evict cached Province / Ward data. Provided for a future admin-driven
 * geography edit — no runtime path calls it today (geography changes via a
 * seed script + redeploy, and a deploy drops the whole Data Cache). It only
 * has an effect when called from a request-scoped context.
 */
export function revalidateGeography() {
  bumpTag(CACHE_TAGS.geography);
}

/**
 * Call after a change that can move a profile in, out of, or around public
 * search / featured results without being tied to one visible profile page.
 */
export function revalidateSearch() {
  bumpTag(CACHE_TAGS.search);
}

/**
 * A provider's public surface changed. Invalidates:
 *  - that provider's per-user reads (`profile:user:<id>` — reviews / stats / shop)
 *  - that provider's public profile page (`profile:name:<username>`)
 *  - the global search + featured strip (`search`)
 *
 * Callers pass a userId (which every relevant mutation has); the username is
 * resolved here so both profile tag families are hit.
 */
export async function revalidatePublicProfile(userId: string) {
  bumpTag(profileUserTag(userId));
  bumpTag(CACHE_TAGS.search);
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (user?.username) bumpTag(profileNameTag(user.username));
  } catch {
    // A failed username lookup must never turn a successful mutation into a
    // 500. The per-user and search tags are already bumped; the profile-page
    // entry falls back to its TTL.
  }
}

/**
 * Invalidate one public profile page by username. Use alongside
 * `revalidatePublicProfile` when a username *changes* — that helper only
 * resolves the current username, so the OLD `/profile/<old>` URL (which now
 * 404s, but whose cache entry still holds the pre-rename data) needs an
 * explicit bump too.
 */
export function revalidateProfileUsername(username: string) {
  bumpTag(profileNameTag(username));
}
