import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { joinVietnameseName, splitVietnameseName } from "@/lib/vietnamese-name";

describe("splitVietnameseName", () => {
  it("greets by the given name, not the family name", () => {
    assert.deepEqual(splitVietnameseName("Trần Văn Hùng"), {
      firstName: "Hùng",
      lastName: "Trần Văn",
    });
  });

  it("keeps a two-word given name together", () => {
    assert.deepEqual(splitVietnameseName("Nguyễn Minh Anh"), {
      firstName: "Minh Anh",
      lastName: "Nguyễn",
    });
    assert.deepEqual(splitVietnameseName("Lê Thị Mai Hương"), {
      firstName: "Mai Hương",
      lastName: "Lê Thị",
    });
  });

  it("does not swallow Văn when it is the given name", () => {
    assert.deepEqual(splitVietnameseName("Phạm Văn"), {
      firstName: "Văn",
      lastName: "Phạm",
    });
  });

  it("handles a single word and stray spaces", () => {
    assert.deepEqual(splitVietnameseName("  Bảo  "), {
      firstName: "Bảo",
      lastName: null,
    });
  });
});

describe("joinVietnameseName", () => {
  it("puts the family name first", () => {
    assert.equal(joinVietnameseName("Minh Anh", "Nguyễn"), "Nguyễn Minh Anh");
    assert.equal(joinVietnameseName("Bảo", null), "Bảo");
  });
});
