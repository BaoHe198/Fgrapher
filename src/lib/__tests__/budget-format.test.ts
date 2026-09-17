import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatBudgetRange } from "@/lib/utils";

describe("formatBudgetRange", () => {
  it("hiển thị đầy đủ khi có cả hai mốc", () => {
    assert.equal(
      formatBudgetRange(500_000, 1_000_000),
      "500.000₫ – 1.000.000₫",
    );
  });

  it("không tự thêm mốc 0 khi chỉ có ngân sách tối thiểu", () => {
    assert.equal(formatBudgetRange(500_000, null), "500.000₫+");
  });

  it("không tự thêm mốc 0 khi chỉ có ngân sách tối đa", () => {
    assert.equal(formatBudgetRange(null, 1_000_000), "≤ 1.000.000₫");
  });

  it("trả null để màn hình dùng nội dung thay thế đã dịch", () => {
    assert.equal(formatBudgetRange(null, undefined), null);
  });
});
