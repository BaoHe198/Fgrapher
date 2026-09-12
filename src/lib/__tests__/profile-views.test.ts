import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  MAX_REMEMBERED_VIEWS,
  VIEW_DEDUPE_WINDOW_SECONDS,
  parseViewState,
  rememberView,
  serializeViewState,
  shouldCountView,
} from "@/lib/profile-views";

const NOW = 1_800_000_000;

describe("shouldCountView", () => {
  it("counts a profile this viewer has never opened", () => {
    assert.equal(shouldCountView({}, "p1", NOW), true);
  });

  it("does not count the same profile twice inside the window", () => {
    const state = rememberView({}, "p1", NOW);
    assert.equal(shouldCountView(state, "p1", NOW), false);
    // The refresh-a-minute case that made the old counter meaningless.
    assert.equal(shouldCountView(state, "p1", NOW + 60), false);
    assert.equal(shouldCountView(state, "p1", NOW + 3600), false);
  });

  it("counts again once the window has passed", () => {
    const state = rememberView({}, "p1", NOW);
    assert.equal(
      shouldCountView(state, "p1", NOW + VIEW_DEDUPE_WINDOW_SECONDS + 1),
      true,
    );
  });

  it("keeps each profile's window independent", () => {
    const state = rememberView({}, "p1", NOW);
    assert.equal(shouldCountView(state, "p2", NOW), true);
  });
});

describe("rememberView", () => {
  it("prunes entries whose window has already passed", () => {
    let state = rememberView({}, "old", NOW);
    state = rememberView(state, "new", NOW + VIEW_DEDUPE_WINDOW_SECONDS + 1);
    assert.deepEqual(Object.keys(state), ["new"]);
  });

  it("caps the cookie so it cannot grow without bound", () => {
    let state = {};
    for (let i = 0; i < MAX_REMEMBERED_VIEWS + 10; i++) {
      state = rememberView(state, `p${i}`, NOW + i);
    }
    assert.equal(Object.keys(state).length, MAX_REMEMBERED_VIEWS);
  });

  it("evicts the oldest entries, not the newest", () => {
    let state = {};
    for (let i = 0; i < MAX_REMEMBERED_VIEWS + 5; i++) {
      state = rememberView(state, `p${i}`, NOW + i);
    }
    const last = `p${MAX_REMEMBERED_VIEWS + 4}`;
    assert.equal(shouldCountView(state, last, NOW + 100), false);
    assert.equal(shouldCountView(state, "p0", NOW + 100), true);
  });

  it("refreshes the window on a repeat view rather than duplicating it", () => {
    const first = rememberView({}, "p1", NOW);
    const second = rememberView(first, "p1", NOW + 10);
    assert.equal(Object.keys(second).length, 1);
    assert.ok(second.p1 > first.p1);
  });

  it("stays well inside the 4KB cookie budget when full", () => {
    let state = {};
    for (let i = 0; i < MAX_REMEMBERED_VIEWS; i++) {
      // A cuid is 25 characters; use a realistic one, not "p1".
      state = rememberView(state, `cl${String(i).padStart(23, "x")}`, NOW + i);
    }
    assert.ok(serializeViewState(state).length < 3000);
  });
});

describe("parseViewState", () => {
  it("round-trips what serializeViewState wrote", () => {
    const state = rememberView(rememberView({}, "p1", NOW), "p2", NOW);
    assert.deepEqual(parseViewState(serializeViewState(state)), state);
  });

  it("treats a missing or unreadable cookie as no history", () => {
    // Costs at most one double-counted view; throwing here would 500 a
    // request whose entire job is to bump a number.
    for (const raw of [undefined, "", "{oops", "null", "[]", '"nope"', "7"]) {
      assert.deepEqual(parseViewState(raw), {});
    }
  });

  it("drops entries that are not numeric expiries", () => {
    assert.deepEqual(
      parseViewState(JSON.stringify({ good: NOW, bad: "soon", worse: null })),
      { good: NOW },
    );
  });
});

describe("where the counting happens", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

  it("the profile page no longer increments on render", () => {
    // A Server Component can't set a cookie, so an increment there can never
    // be deduplicated — it counted every refresh, tab restore and crawler.
    const page = read("src/app/(public)/profile/[username]/page.tsx");
    assert.doesNotMatch(page, /incrementProfileView/);
    assert.match(page, /ProfileViewBeacon/);
  });

  it("only the view route increments", () => {
    const route = read("src/app/api/profiles/view/route.ts");
    assert.match(route, /incrementProfileView\(profileId\)/);
    // Owners looking at their own page must not inflate their own number.
    assert.match(route, /session\?\.user\?\.id === profile\.userId/);
  });

  it("scopes the cookie to the one endpoint that reads it", () => {
    const route = read("src/app/api/profiles/view/route.ts");
    assert.match(route, /path: PROFILE_VIEW_COOKIE_PATH/);
    assert.match(route, /httpOnly: true/);
  });
});
