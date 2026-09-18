import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { omitPrivateProfileFields } from "@/lib/profile-privacy";

describe("public profile privacy boundary", () => {
  it("removes the detailed address and post-booking Zalo contact", () => {
    const result = omitPrivateProfileFields({
      id: "profile-1",
      displayName: "Studio Hoa",
      address: "12 đường riêng tư",
      zaloUrl: "https://zalo.me/private-contact",
    });

    assert.deepEqual(result, {
      id: "profile-1",
      displayName: "Studio Hoa",
    });
    assert.equal("address" in result, false);
    assert.equal("zaloUrl" in result, false);
  });
});
