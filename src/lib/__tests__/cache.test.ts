import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  CACHE_KEY_VERSION,
  CACHE_TAGS,
  CACHE_TTL,
  GEOGRAPHY_CACHE_CONTROL,
  PUBLIC_SEARCH_CACHE_CONTROL,
  profileNameTag,
  profileUserTag,
  reviveDates,
} from "@/lib/cache-tags";
import {
  FEATURED_RATED_PROVIDER_WHERE,
  PUBLIC_USER_FILTER,
} from "@/services/search";

const repoRoot = path.resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

describe("cache tag helpers", () => {
  it("builds stable, namespaced tags", () => {
    assert.equal(CACHE_TAGS.geography, "geography");
    assert.equal(CACHE_TAGS.search, "search");
    assert.equal(profileUserTag("u_123"), "profile:user:u_123");
    assert.equal(profileNameTag("photog"), "profile:name:photog");
  });

  it("lower-cases the username tag so /profile/Bao and /profile/bao share an entry", () => {
    assert.equal(profileNameTag("Bao"), profileNameTag("bao"));
    assert.equal(profileNameTag("BAO"), "profile:name:bao");
  });

  it("keeps the documented TTL ordering (geography >> featured >> search)", () => {
    assert.ok(CACHE_TTL.geography > CACHE_TTL.featured);
    assert.ok(CACHE_TTL.featured > CACHE_TTL.search);
    assert.equal(CACHE_TTL.geography, 86400);
    assert.ok(CACHE_TTL.search >= 60 && CACHE_TTL.search <= 120);
  });
});

describe("reviveDates — cache MISS shape (real Date objects in, unchanged out)", () => {
  it("preserves a Date sitting at a timestamp key (the JSON.stringify bug this guards)", () => {
    const createdAt = new Date("2024-01-02T03:04:05.000Z");
    const out = reviveDates({ id: "x", createdAt });
    assert.ok(out.createdAt instanceof Date);
    assert.equal(out.createdAt.getTime(), createdAt.getTime());
    // Object.entries(new Date()) is [] — a naive walk would have made this {}.
    assert.notDeepEqual(out.createdAt, {});
  });

  it("preserves Dates nested in arrays and sub-objects", () => {
    const dob = new Date("1996-05-04T00:00:00.000Z");
    const reviewedAt = new Date("2024-08-01T12:00:00.000Z");
    const input = {
      user: { username: "m", dateOfBirth: dob },
      reviews: [{ id: "r1", createdAt: reviewedAt, content: "great" }],
    };
    const out = reviveDates(input);
    assert.ok(out.user.dateOfBirth instanceof Date);
    assert.equal(out.user.dateOfBirth.getTime(), dob.getTime());
    assert.ok(out.reviews[0].createdAt instanceof Date);
    assert.equal(out.reviews[0].content, "great");
  });

  it("passes non-plain class instances straight through (stands in for Prisma Decimal)", () => {
    class Money {
      constructor(public cents: number) {}
    }
    const out = reviveDates({ price: new Money(1500), label: "pkg" });
    assert.ok(out.price instanceof Money);
    assert.equal(out.price.cents, 1500);
  });

  it("leaves a real Date at a non-timestamp key intact too", () => {
    const shootDate = new Date("2024-03-03T00:00:00.000Z");
    const out = reviveDates({ shootDate });
    assert.ok(out.shootDate instanceof Date);
  });
});

describe("reviveDates — cache HIT shape (JSON round-tripped: ISO strings back to Date)", () => {
  const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  it("restores Date instances that JSON.stringify flattened to ISO strings", () => {
    const source = {
      user: { dateOfBirth: new Date("1996-05-04T00:00:00.000Z") },
      reviews: [
        {
          id: "r1",
          createdAt: new Date("2024-08-01T12:00:00.000Z"),
          updatedAt: new Date("2024-08-01T12:30:00.000Z"),
        },
        {
          id: "r2",
          createdAt: new Date("2024-08-02T12:00:00.000Z"),
          updatedAt: new Date("2024-08-02T12:30:00.000Z"),
        },
      ],
      moderatedAt: new Date("2024-08-03T09:00:00.000Z"),
    };

    const onCacheHit = reviveDates(roundTrip(source));
    const [first, second] = onCacheHit.reviews;
    assert.ok(first && second);

    assert.ok(onCacheHit.user.dateOfBirth instanceof Date);
    assert.equal(
      onCacheHit.user.dateOfBirth.getTime(),
      source.user.dateOfBirth.getTime(),
    );
    assert.ok(first.createdAt instanceof Date);
    assert.ok(second.updatedAt instanceof Date);
    assert.ok(onCacheHit.moderatedAt instanceof Date);
    // The consumer calls this on the public profile page — it must not throw.
    assert.equal(
      first.createdAt.toISOString(),
      source.reviews[0]!.createdAt.toISOString(),
    );
  });

  it("does not convert ordinary strings, including an ISO-looking value at a non-date key", () => {
    const onCacheHit = reviveDates(
      roundTrip({
        username: "photog2024",
        title: "2024-01-01 retrospective",
        note: "2024-01-01T00:00:00.000Z", // ISO-shaped, but 'note' is not a date key
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
    );
    assert.equal(typeof onCacheHit.username, "string");
    assert.equal(typeof onCacheHit.title, "string");
    assert.equal(typeof onCacheHit.note, "string");
    assert.ok(onCacheHit.createdAt instanceof Date);
  });

  it("handles null and primitives without throwing", () => {
    assert.equal(reviveDates(null), null);
    assert.equal(reviveDates(42), 42);
    assert.deepEqual(reviveDates({ deletedAt: null }), { deletedAt: null });
  });
});

// -----------------------------------------------------------------------------
// Wiring guards. These read the real source files and fail if a cached read
// stops being cached, or a mutation that can change public results stops
// invalidating. They assert on call-site presence only — no algorithm is
// re-implemented here.
// -----------------------------------------------------------------------------

describe("cached reads stay cached", () => {
  const cachedReadModules = [
    "src/services/geography.ts",
    "src/services/search.ts",
    "src/services/public-profile.ts",
  ];

  for (const mod of cachedReadModules) {
    it(`${mod} still wraps its public reads in unstable_cache`, () => {
      assert.match(read(mod), /unstable_cache\(/);
    });
  }

  it("the availability API is no-store, not a shared cache", () => {
    const src = read("src/app/api/availability/[providerId]/route.ts");
    assert.match(src, /"Cache-Control":\s*"no-store"/);
    // No shared-cache directive in an actual header value (comments aside).
    assert.doesNotMatch(src, /"Cache-Control":\s*"[^"]*s-maxage/);
  });

  it("the public geography + search APIs send their Cache-Control header", () => {
    assert.match(
      read("src/app/api/geography/provinces/route.ts"),
      /GEOGRAPHY_CACHE_CONTROL/,
    );
    assert.match(
      read("src/app/api/geography/wards/route.ts"),
      /GEOGRAPHY_CACHE_CONTROL/,
    );
    assert.match(
      read("src/app/api/search/route.ts"),
      /PUBLIC_SEARCH_CACHE_CONTROL/,
    );
  });

  it("geography may sit in a shared cache — it carries no visibility state", () => {
    assert.match(GEOGRAPHY_CACHE_CONTROL, /^public,.*s-maxage=\d+/);
  });

  it("search must NOT sit in a shared cache — revalidateTag cannot reach a CDN", () => {
    // A CDN window here would keep serving a just-suspended / soft-deleted /
    // unpublished provider for its whole duration, because tag invalidation
    // only clears the origin Data Cache.
    assert.equal(PUBLIC_SEARCH_CACHE_CONTROL, "no-store");
    assert.doesNotMatch(PUBLIC_SEARCH_CACHE_CONTROL, /s-maxage|public/);
  });

  it("every unstable_cache key carries CACHE_KEY_VERSION", () => {
    // unstable_cache persists across deployments, so a return-shape change or
    // an out-of-band reseed needs a new key to take effect. Each cached read
    // must therefore include the version segment.
    assert.match(CACHE_KEY_VERSION, /^v\d+$/);
    for (const mod of cachedReadModules) {
      const src = read(mod);
      const wraps = (src.match(/unstable_cache\(/g) ?? []).length;
      const versioned = (src.match(/\[\s*CACHE_KEY_VERSION,/g) ?? []).length;
      assert.equal(
        versioned,
        wraps,
        `${mod}: ${wraps} unstable_cache call(s) but ${versioned} versioned key(s)`,
      );
    }
  });
});

describe("public reads exclude suspended / soft-deleted accounts", () => {
  it("PUBLIC_USER_FILTER requires a live, unsuspended owner", () => {
    assert.deepEqual(PUBLIC_USER_FILTER, {
      deletedAt: null,
      isSuspended: false,
    });
  });

  it("search.ts applies the owner filter to every public Profile query", () => {
    const src = read("src/services/search.ts");
    const applied = src.match(/user:\s*PUBLIC_USER_FILTER/g) ?? [];
    // buildBaseWhere, resolveProviderCards' hydrate query, the facet query,
    // and the featured strip's two queries.
    assert.ok(
      applied.length >= 5,
      `expected PUBLIC_USER_FILTER on >=5 queries, found ${applied.length}`,
    );
    // No bare `isPublished: true` query without the owner filter nearby.
    assert.doesNotMatch(
      src,
      /isPublished:\s*true,\s*\n\s*role:\s*\{/,
      "found an isPublished query with no `user:` filter immediately after",
    );
  });

  it("getPublicProfileUser + getProviderForBooking filter on deletedAt AND isSuspended", () => {
    const src = read("src/services/public-profile.ts");
    const matches =
      src.match(/deletedAt:\s*null,\s*isSuspended:\s*false/g) ?? [];
    assert.ok(
      matches.length >= 2,
      `expected the live-owner filter on >=2 reads, found ${matches.length}`,
    );
  });

  it("getShopProducts is left uncached while the marketplace is off", () => {
    const src = read("src/services/public-profile.ts");
    assert.doesNotMatch(src, /"shop-products"/);
    assert.match(src, /NOT cached/);
  });
});

describe("featured strip ranks only eligible providers", () => {
  // Regression: review.groupBy used `take: limit` with no `where`, so it took
  // the top N reviewed users platform-wide and *then* filtered for published /
  // live / searchable-role owners. An ineligible high-rated user burned a slot
  // and produced no card, and an eligible rated provider ranked just below the
  // cutoff was never considered — the slot silently fell through to the
  // "newest published" backfill instead.

  it("the eligibility filter demands a live owner with a published searchable profile", () => {
    const { reviewed } = FEATURED_RATED_PROVIDER_WHERE;

    // Same live-owner rule the rest of the public reads use.
    assert.equal(reviewed.deletedAt, PUBLIC_USER_FILTER.deletedAt);
    assert.equal(reviewed.isSuspended, PUBLIC_USER_FILTER.isSuspended);

    // ...plus "can actually be shown on a card at all".
    const shown = reviewed.profiles.some;
    assert.equal(shown.isPublished, true);
    assert.ok(
      Array.isArray(shown.role.in) && shown.role.in.length > 0,
      "the searchable-role list must be a non-empty allow-list",
    );
    // CAMERA_SHOP is dormant behind MARKETPLACE_ENABLED, which defaults off.
    assert.ok(
      !(shown.role.in as readonly string[]).includes("CAMERA_SHOP"),
      "a role that cannot appear in search must not be able to win a featured slot",
    );
  });

  it("review.groupBy applies that filter before `take`, not after", () => {
    const src = read("src/services/search.ts");
    // Anchored on the featured strip's own call — search.ts has a second,
    // unrelated review.groupBy inside resolveProviderCards.
    const groupBy = src.match(
      /const rated = await db\.review\.groupBy\(\{[\s\S]*?\n {2}\}\);/,
    );
    assert.ok(
      groupBy,
      "could not locate the featured strip's review.groupBy call in search.ts",
    );

    const call = groupBy[0];
    assert.match(
      call,
      /where:\s*FEATURED_RATED_PROVIDER_WHERE/,
      "review.groupBy lost its eligibility `where` — `take` would again spend slots on providers that cannot be shown",
    );
    assert.match(call, /take:\s*limit/);
    // The filter has to be inside the grouped query itself; a `where` on the
    // findMany that follows is what the original bug already did.
    assert.ok(
      call.indexOf("where:") < call.indexOf("take:"),
      "the eligibility filter must constrain the grouped query, not run after it",
    );
  });
});

describe("cache.ts uses immediate expiry, not stale-while-revalidate", () => {
  it("bumpTag passes { expire: 0 } so a removed profile is never served stale", () => {
    const src = read("src/lib/cache.ts");
    assert.match(src, /revalidateTag\([^)]*\{\s*expire:\s*0\s*\}\s*\)/);
    assert.doesNotMatch(src, /revalidateTag\([^)]*"max"/);
  });

  it("a failed bump is logged, not silently swallowed", () => {
    const src = read("src/lib/cache.ts");
    assert.match(src, /console\.error\([^)]*revalidateTag/);
  });
});

describe("public-result mutations invalidate the cache", () => {
  // Strip line comments and block comments so "in a comment" can't satisfy a
  // check. Crude but enough to catch the "call moved into a comment / dead
  // branch note" regression the plain includes() check would miss.
  const codeOnly = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");

  // file -> [minimum awaited revalidatePublicProfile() calls, extra symbols]
  const mustInvalidate: Record<
    string,
    { profileCalls: number; also?: string[] }
  > = {
    // setProfilePublished (covers tryAutoPublish everywhere)
    "src/services/public-profile.ts": { profileCalls: 1 },
    // createReview, updateReview, respondToReview, updateReviewResponse
    "src/services/reviews.ts": { profileCalls: 4 },
    // updateAlbum, reorderAlbums, deleteAlbum, restoreAlbum, restoreMedia
    "src/services/albums.ts": { profileCalls: 5 },
    // moderateMedia (approve+reject), reviewVerification, suspend/unsuspend/
    // softDelete, applyViolationStrikes' 3-strike auto-suspension
    "src/services/admin.ts": { profileCalls: 6 },
    // src/services/moderation.ts deliberately has NO entry. runModeration()
    // only ever moves a just-uploaded row from PENDING to AUTO_REJECTED, and
    // PENDING was never public in the first place, so nothing cached changes.
    // It used to suspend accounts too — that moved to admin.ts (a machine may
    // hide a photo, only a human may penalise an account), and the
    // revalidation moved with it.
    "src/services/role-change-requests.ts": { profileCalls: 1 },
    // handleSubscriptionDeleted
    "src/services/subscription.ts": { profileCalls: 1 },
    // expireLocalSubscriptions loop
    "src/services/payments.ts": { profileCalls: 1 },
    // processDeletion — plus the old username tag
    "src/services/compliance.ts": {
      profileCalls: 1,
      also: ["revalidateProfileUsername"],
    },
    "src/app/api/profiles/[role]/route.ts": { profileCalls: 1 },
    "src/app/api/profiles/[role]/service-areas/route.ts": { profileCalls: 1 },
    "src/app/api/portfolio/[id]/route.ts": { profileCalls: 1 },
    "src/app/api/portfolio/reorder/route.ts": { profileCalls: 1 },
    "src/app/api/services/route.ts": { profileCalls: 1 },
    "src/app/api/services/[id]/route.ts": { profileCalls: 2 }, // PATCH + DELETE
    "src/app/api/onboarding/complete-profile/route.ts": { profileCalls: 1 },
    // PATCH (rename) + DELETE (self-delete), both also clearing the old
    // username tag.
    "src/app/api/users/me/route.ts": {
      profileCalls: 2,
      also: ["revalidateProfileUsername"],
    },
  };

  for (const [file, { profileCalls, also }] of Object.entries(mustInvalidate)) {
    it(`${file} calls revalidatePublicProfile() x${profileCalls}${
      also ? ` + ${also.join(" + ")}` : ""
    }`, () => {
      const src = codeOnly(read(file));
      // Comments are stripped, and the only non-call occurrence
      // (`import { revalidatePublicProfile }`) has no `(` after the name.
      const calls = src.match(/revalidatePublicProfile\(/g) ?? [];
      assert.ok(
        calls.length >= profileCalls,
        `${file}: expected >=${profileCalls} revalidatePublicProfile() call(s), found ${calls.length} — a public-data mutation here would serve stale cache`,
      );
      for (const symbol of also ?? []) {
        assert.ok(
          src.includes(`${symbol}(`),
          `${file} no longer calls ${symbol}`,
        );
      }
    });
  }
});
