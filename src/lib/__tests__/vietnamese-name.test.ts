import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { joinVietnameseName, splitVietnameseName } from "@/lib/vietnam/name";

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

  it("splits a name typed without accents", () => {
    assert.deepEqual(splitVietnameseName("Nguyen Thi Lan"), {
      firstName: "Lan",
      lastName: "Nguyen Thi",
    });
  });

  it("keeps a trade name whole", () => {
    // Not a family name first: "Lan Anh Studio" was called "Anh Studio".
    assert.deepEqual(splitVietnameseName("Lan Anh Studio"), {
      firstName: "Lan Anh Studio",
      lastName: null,
    });
    // A family name first, but a trade word in it.
    assert.deepEqual(splitVietnameseName("Mai Anh Wedding"), {
      firstName: "Mai Anh Wedding",
      lastName: null,
    });
    assert.deepEqual(splitVietnameseName("Phạm Media"), {
      firstName: "Phạm Media",
      lastName: null,
    });
  });

  it("keeps a name in another order whole", () => {
    assert.deepEqual(splitVietnameseName("John Smith"), {
      firstName: "John Smith",
      lastName: null,
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
