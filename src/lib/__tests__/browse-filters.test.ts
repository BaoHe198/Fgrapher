import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_BROWSE_FILTERS,
  clearBrowseFilters,
  readBrowseFilters,
  writeBrowseFilters,
} from "@/lib/browse-filters";
import {
  isSameFilterQuery,
  nextFilterQuery,
  setOrDelete,
} from "@/lib/filter-params";

// QA-01 (22/09/2026): on /browse, searching "Thanh Tâm" narrowed the grid to
// one card — and then ticking a role checkbox put all eight back with the
// search box empty. The URL changed each time, so it read as "the filter
// isn't applying". The cause was not navigation at all: the sidebar wrote
// the whole query string from a BrowseFilterState, and that type has no `q`
// field, so the keyword was dropped on every single filter click.
//
// QA-02 was the same class of bug on /shop, arrived at differently: each
// control built its query from the URL the browser had committed, so a
// control touched before the previous navigation landed built on a URL
// without it. Typing "Canon" and clicking "Cho thuê" — blur and click are
// one gesture — produced `?type=RENT` with "Canon" still in the box.

function query(filters: Partial<typeof EMPTY_BROWSE_FILTERS>, initial = "") {
  const params = new URLSearchParams(initial);
  writeBrowseFilters(params, { ...EMPTY_BROWSE_FILTERS, ...filters });
  return params;
}

describe("writeBrowseFilters", () => {
  it("keeps the search keyword when a role is ticked", () => {
    const params = query({ roles: ["PHOTOGRAPHER"] }, "q=Thanh+T%C3%A2m");
    assert.equal(params.get("q"), "Thanh Tâm");
    assert.equal(params.get("roles"), "PHOTOGRAPHER");
  });

  it("keeps the search keyword when the sort order changes", () => {
    const params = query({ sort: "newest" }, "q=Thanh");
    assert.equal(params.get("q"), "Thanh");
    assert.equal(params.get("sort"), "newest");
  });

  it("leaves params it does not own alone", () => {
    const params = query({ city: "ho-chi-minh" }, "q=Thanh&utm_source=zalo");
    assert.equal(params.get("utm_source"), "zalo");
  });

  it("removes a filter that went back to its default", () => {
    const params = query({}, "q=Thanh&roles=PHOTOGRAPHER&sort=newest");
    assert.equal(params.get("roles"), null);
    assert.equal(
      params.get("sort"),
      null,
      "rating is the default, not a filter",
    );
    assert.equal(params.get("q"), "Thanh");
  });

  it("drops the ward once the province is cleared", () => {
    const params = query({ city: "", ward: "ward-1" });
    assert.equal(params.get("ward"), null);
  });

  it("drops MODEL-only criteria as soon as the selection is not just MODEL", () => {
    const modelOnly = query({
      roles: ["MODEL"],
      heightMin: "160",
      experienceLevel: ["PROFESSIONAL"],
      travelWilling: true,
    });
    assert.equal(modelOnly.get("heightMin"), "160");
    assert.equal(modelOnly.get("travelWilling"), "1");

    const widened = query({
      roles: ["MODEL", "PHOTOGRAPHER"],
      heightMin: "160",
      experienceLevel: ["PROFESSIONAL"],
      travelWilling: true,
    });
    assert.equal(widened.get("heightMin"), null);
    assert.equal(widened.get("experienceLevel"), null);
    assert.equal(widened.get("travelWilling"), null);
  });

  it("round-trips through readBrowseFilters", () => {
    const filters = {
      ...EMPTY_BROWSE_FILTERS,
      roles: ["MODEL" as const],
      categories: ["PORTRAIT" as const],
      city: "ho-chi-minh",
      ward: "ward-1",
      minPrice: "2000000",
      sort: "newest",
      heightMin: "160",
      travelWilling: true,
    };
    const params = new URLSearchParams("q=Thanh");
    writeBrowseFilters(params, filters);
    assert.deepEqual(readBrowseFilters(params), filters);
  });
});

describe("clearBrowseFilters", () => {
  it("clears the sidebar's criteria but not the search keyword", () => {
    const params = new URLSearchParams(
      "q=Thanh&roles=PHOTOGRAPHER&city=ho-chi-minh&minRating=4",
    );
    clearBrowseFilters(params);
    assert.equal(params.toString(), "q=Thanh");
  });
});

describe("nextFilterQuery", () => {
  it("builds each change on the previous intent, not on a committed URL", () => {
    // The /shop sequence from QA-02, in the order a person performs it.
    let q = nextFilterQuery("", (p) => setOrDelete(p, "q", "Canon"));
    q = nextFilterQuery(q, (p) => p.set("type", "RENT"));
    const params = new URLSearchParams(q);
    assert.equal(params.get("q"), "Canon", "the keyword was overwritten again");
    assert.equal(params.get("type"), "RENT");
  });

  it("returns to page 1 whenever a filter changes", () => {
    const q = nextFilterQuery("page=3&q=Canon", (p) => p.set("type", "RENT"));
    assert.equal(new URLSearchParams(q).get("page"), null);
  });

  it("deletes a key when the new value is empty", () => {
    const q = nextFilterQuery("q=Canon", (p) => setOrDelete(p, "q", ""));
    assert.equal(q, "");
  });
});

describe("isSameFilterQuery", () => {
  it("ignores key order, so a navigation we caused is recognised as ours", () => {
    assert.ok(isSameFilterQuery("q=Canon&type=RENT", "type=RENT&q=Canon"));
  });

  it("still tells a genuinely different query apart", () => {
    assert.ok(!isSameFilterQuery("q=Canon", "q=Canon&type=RENT"));
  });
});
