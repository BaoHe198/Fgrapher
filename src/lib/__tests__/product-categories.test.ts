import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  CAMERA_PRODUCT_CATEGORIES,
  LEGACY_PRODUCT_CATEGORY_ALIASES,
  PRODUCT_CATEGORIES,
  normalizeProductCategory,
  productCategoriesForRole,
  productCategoryQueryValues,
} from "@/lib/validations/product";

// QA-04 (22/09/2026): Văn Long Camera had five products visible on /shop and
// in /dashboard/listings, while the Sản phẩm tab of its own public profile
// said the shop had posted nothing. Product.category is an unconstrained
// String; the seed wrote Vietnamese display labels ("Thân máy", "Ống kính")
// into it while every validator and query used the English codes. /shop does
// not filter by category, the profile tab does — so the same rows were
// present on one page and absent on the other.

const repoRoot = path.resolve(__dirname, "../../..");

describe("normalizeProductCategory", () => {
  it("passes a canonical category through unchanged", () => {
    for (const category of CAMERA_PRODUCT_CATEGORIES) {
      assert.equal(normalizeProductCategory(category), category);
    }
  });

  it("maps every legacy label onto a canonical category", () => {
    for (const [legacy, canonical] of Object.entries(
      LEGACY_PRODUCT_CATEGORY_ALIASES,
    )) {
      assert.equal(normalizeProductCategory(legacy), canonical);
      assert.ok(
        (CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(canonical),
        `${legacy} maps to ${canonical}, which is not a category`,
      );
    }
  });

  it("covers the five labels the seed actually wrote", () => {
    for (const legacy of [
      "Thân máy",
      "Ống kính",
      "Ánh sáng",
      "Âm thanh",
      "Phụ kiện hỗ trợ",
    ]) {
      assert.ok(normalizeProductCategory(legacy), `${legacy} is unmapped`);
    }
  });

  it("returns null for something it has never seen", () => {
    assert.equal(normalizeProductCategory("Áo dài"), null);
  });
});

describe("productCategoryQueryValues", () => {
  it("still matches a row the migration has not reached", () => {
    const values = productCategoryQueryValues(["Lens"]);
    assert.ok(values.includes("Lens"));
    assert.ok(values.includes("Ống kính"));
  });

  it("brings in no alias for a category that was not asked for", () => {
    assert.ok(!productCategoryQueryValues(["Lens"]).includes("Thân máy"));
  });

  it("covers every legacy label when given the whole role list", () => {
    const values = productCategoryQueryValues(
      productCategoriesForRole("CAMERA_SHOP"),
    );
    for (const legacy of Object.keys(LEGACY_PRODUCT_CATEGORY_ALIASES)) {
      assert.ok(values.includes(legacy), `${legacy} would be filtered out`);
    }
  });

  it("does not repeat a value", () => {
    const values = productCategoryQueryValues(["Lens", "Lens"]);
    assert.equal(new Set(values).size, values.length);
  });
});

describe("dữ liệu seed và validation dùng chung một bảng danh mục", () => {
  const seed = readFileSync(path.join(repoRoot, "prisma/seed.ts"), "utf8");
  const seedProducts = seed.slice(
    seed.indexOf("async function seedProducts()"),
  );

  it("mọi danh mục trong seed đều là giá trị hợp lệ", () => {
    const used = [...seedProducts.matchAll(/category:\s*"([^"]+)"/g)].map(
      (m) => m[1],
    );
    assert.ok(used.length > 0, "no seeded product categories found");
    for (const category of used) {
      assert.ok(
        (PRODUCT_CATEGORIES as readonly string[]).includes(category),
        `seed writes "${category}", which productSchema would reject`,
      );
    }
  });
});

describe("truy vấn hồ sơ công khai chịu được dữ liệu cũ", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/services/public-profile.ts"),
    "utf8",
  );

  it("lọc danh mục qua helper có alias, không qua danh sách thô", () => {
    // The whole bug was a bare `in: [...productCategoriesForRole(role)]`
    // silently excluding rows. Both call sites must go through the helper.
    assert.equal(
      (source.match(/productCategoryQueryValues\(/g) ?? []).length,
      2,
      "a category filter in public-profile.ts is back to the raw list",
    );
    assert.doesNotMatch(
      source,
      /in:\s*\[\.\.\.productCategoriesForRole\(role\)\]/,
    );
  });
});
