import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { usernameBase } from "@/lib/username";

describe("usernameBase", () => {
  it("uses the name without accents or spaces", () => {
    assert.equal(usernameBase("Nguyễn Minh Anh", "x@y.vn"), "nguyenminhanh");
    assert.equal(usernameBase("Đỗ Đức Thịnh", "x@y.vn"), "doducthinh");
  });

  it("falls back to the email when the name is too short", () => {
    assert.equal(usernameBase("A", "thao.le92@gmail.com"), "thaole92");
    assert.equal(usernameBase(null, "an@x.vn"), "useran");
  });

  it("always fits the username rule", () => {
    for (const [name, email] of [
      ["Trương Thị Ngọc Lĩnh Studio Chụp Ảnh Cưới", "a@b.c"],
      ["😀😀", "ab@c.d"],
      ["", "@x.y"],
    ] as const) {
      const u = usernameBase(name, email);
      assert.match(u, /^[a-z0-9_]{3,30}$/);
    }
  });
});
