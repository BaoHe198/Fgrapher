import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeMessages } from "@/hooks/polling-policy";

const m = (id: string, at: string, readAt: string | null = null) => ({
  id,
  createdAt: at,
  readAt,
});

describe("what the chat shows after another batch arrives", () => {
  it("keeps older pages when a poll brings only the newest", () => {
    // The panel used to replace its list with each poll's answer.
    const shown = [
      m("a", "2026-11-19T10:00:00Z"),
      m("b", "2026-11-19T10:01:00Z"),
    ];
    const poll = [
      m("b", "2026-11-19T10:01:00Z"),
      m("c", "2026-11-19T10:02:00Z"),
    ];
    assert.deepEqual(
      mergeMessages(shown, poll).map((x) => x.id),
      ["a", "b", "c"],
    );
  });

  it("puts an older page in front, oldest first", () => {
    const shown = [m("c", "2026-11-19T10:02:00Z")];
    const older = [
      m("a", "2026-11-19T10:00:00Z"),
      m("b", "2026-11-19T10:01:00Z"),
    ];
    assert.deepEqual(
      mergeMessages(shown, older).map((x) => x.id),
      ["a", "b", "c"],
    );
  });

  it("shows a message once, and takes the newer copy of it", () => {
    const sent = [m("a", "2026-11-19T10:00:00Z")];
    const poll = [m("a", "2026-11-19T10:00:00Z", "2026-11-19T10:05:00Z")];
    const merged = mergeMessages(sent, poll);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].readAt, "2026-11-19T10:05:00Z");
  });

  it("orders two messages of the same instant the same way every time", () => {
    const at = "2026-11-19T10:00:00Z";
    assert.deepEqual(
      mergeMessages([m("b", at)], [m("a", at)]).map((x) => x.id),
      mergeMessages([m("a", at)], [m("b", at)]).map((x) => x.id),
    );
  });

  it("accepts Date objects as well as ISO strings", () => {
    const merged = mergeMessages(
      [{ id: "b", createdAt: new Date("2026-11-19T10:01:00Z") }],
      [{ id: "a", createdAt: "2026-11-19T10:00:00Z" }],
    );
    assert.deepEqual(
      merged.map((x) => x.id),
      ["a", "b"],
    );
  });
});
