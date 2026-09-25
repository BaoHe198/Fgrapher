import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  escapeLike,
  foldVietnamese,
  SQL_FOLD_FROM,
  SQL_FOLD_TO,
} from "@/lib/vietnamese-fold";

// What Postgres does: translate() then lower().
function sqlFold(text: string) {
  const to = [...SQL_FOLD_TO];
  return [...text]
    .map((char) => {
      const i = [...SQL_FOLD_FROM].indexOf(char);
      return i === -1 ? char : (to[i] ?? "");
    })
    .join("")
    .toLowerCase();
}

describe("foldVietnamese", () => {
  it("drops tones and vowel marks, and đ becomes d", () => {
    assert.equal(foldVietnamese("Nhiếp ảnh gia"), "nhiep anh gia");
    assert.equal(foldVietnamese("Đức Thịnh"), "duc thinh");
    assert.equal(
      foldVietnamese("Chuyên viên trang điểm"),
      "chuyen vien trang diem",
    );
  });
});

describe("SQL folding", () => {
  it("maps every precomposed letter to one plain letter", () => {
    // The combining marks at the end have no partner in TO: deleted.
    assert.equal([...SQL_FOLD_TO].length, [...SQL_FOLD_FROM].length - 8);
  });

  it("folds stored text the same way the typed query is folded", () => {
    for (const text of [
      "Nhiếp Ảnh Minh Anh",
      "ĐÈN FLASH Godox",
      "Trương Thị Ngọc Lĩnh",
    ]) {
      assert.equal(sqlFold(text), foldVietnamese(text));
    }
    // decomposed input (some keyboards) folds too
    assert.equal(sqlFold("Nhiếp"), "nhiep");
  });
});

describe("escapeLike", () => {
  it("treats % and _ as literal text", () => {
    assert.equal(escapeLike("50%_off"), "50\\%\\_off");
  });
});
