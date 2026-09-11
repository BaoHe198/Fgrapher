import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { resolvePartyName } from "@/lib/party-name";

const repoRoot = path.resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), "utf8");

const fallback = "Người dùng";

describe("resolvePartyName", () => {
  it("prefers the provider's public display name", () => {
    // The reported bug: profile said "Đi Tìm PhotoBOOK", chat said "Bao He".
    assert.equal(
      resolvePartyName(
        {
          name: "Bao He",
          firstName: "Bao",
          username: "baohe",
          profiles: [{ displayName: "Đi Tìm PhotoBOOK" }],
        },
        fallback,
      ),
      "Đi Tìm PhotoBOOK",
    );
  });

  it("falls back to the first name for someone with no provider profile", () => {
    // A plain customer has no Profile row, so their account name is their
    // only identity — nothing to be out of sync with.
    assert.equal(
      resolvePartyName(
        { name: "Bao He", firstName: "Bao", username: "baohe", profiles: [] },
        fallback,
      ),
      "Bao",
    );
  });

  it("ignores a profile that exists but has no display name set", () => {
    assert.equal(
      resolvePartyName(
        { name: "Bao He", firstName: null, profiles: [{ displayName: null }] },
        fallback,
      ),
      "Bao He",
    );
  });

  it("skips past profiles with no display name to one that has it", () => {
    assert.equal(
      resolvePartyName(
        {
          name: "Bao He",
          firstName: "Bao",
          profiles: [{ displayName: null }, { displayName: "Studio X" }],
        },
        fallback,
      ),
      "Studio X",
    );
  });

  it("treats a missing profiles field the same as none", () => {
    // Callers that never select profiles (older payloads) must still work.
    assert.equal(
      resolvePartyName({ name: "Bao He", firstName: null }, fallback),
      "Bao He",
    );
  });

  it("uses the handle before giving up", () => {
    assert.equal(
      resolvePartyName(
        { name: null, firstName: null, username: "baohe" },
        fallback,
      ),
      "baohe",
    );
  });

  it("falls back when there is nothing at all", () => {
    assert.equal(
      resolvePartyName({ name: null, firstName: null }, fallback),
      fallback,
    );
  });
});

describe("the chat UI has no private copy of the naming rule", () => {
  const consumers = [
    "src/components/chat/chat-panel.tsx",
    "src/components/chat/conversation-list.tsx",
  ];

  for (const file of consumers) {
    it(`${file} uses the shared resolver`, () => {
      const src = read(file);
      assert.match(src, /resolvePartyName\(/);
      // Each of these used to define its own `firstName ?? name` helper,
      // which is how they drifted from the profile page in the first place.
      assert.doesNotMatch(src, /function partyName\(/);
    });
  }

  it("the server sends the display name the resolver needs", () => {
    const src = read("src/services/messaging.ts");
    assert.match(src, /profiles:\s*\{[\s\S]{0,200}displayName:\s*true/);
    assert.match(src, /isPublished:\s*true/);
  });
});
