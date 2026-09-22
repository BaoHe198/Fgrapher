import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { PRODUCT_CATEGORIES } from "@/lib/validations/product";

// QA-05 (22/09/2026): a Vietnamese visitor on a Chợ F product page read
// "New", "Message" and "2 in stock" among otherwise Vietnamese copy, and the
// category filter offered "Camera body" and "Lens". Product.category holds a
// stored code, not display text (lib/validations/product.ts), and nothing
// had ever translated it — the checkbox printed the code straight out.

const repoRoot = path.resolve(__dirname, "../../..");

function messages(locale: "vi" | "en"): Record<string, never> {
  return JSON.parse(
    readFileSync(path.join(repoRoot, `src/messages/${locale}.json`), "utf8"),
  );
}

describe("nhãn danh mục sản phẩm", () => {
  for (const locale of ["vi", "en"] as const) {
    it(`có bản dịch ${locale} cho mọi danh mục`, () => {
      const catalogue = messages(locale) as unknown as {
        productCategory?: Record<string, string>;
      };
      assert.ok(catalogue.productCategory, "productCategory namespace missing");
      for (const category of PRODUCT_CATEGORIES) {
        assert.ok(
          catalogue.productCategory[category],
          `no ${locale} label for "${category}"`,
        );
      }
    });
  }

  it("bản tiếng Việt không để nguyên mã tiếng Anh", () => {
    const vi = messages("vi") as unknown as {
      productCategory: Record<string, string>;
    };
    // Every code here is English and has a real Vietnamese word for it, so
    // an untranslated entry is a missed one, not a deliberate loanword.
    for (const category of PRODUCT_CATEGORIES) {
      assert.notEqual(
        vi.productCategory[category],
        category,
        `"${category}" is still untranslated in vi.json`,
      );
    }
  });
});

describe("trang chi tiết sản phẩm không còn chuỗi cứng tiếng Anh", () => {
  const files = [
    "src/app/(public)/shop/[productId]/page.tsx",
    "src/app/(public)/shop/[productId]/product-purchase-panel.tsx",
    "src/components/shop/shop-filters.tsx",
    "src/components/forms/product-form.tsx",
  ];

  it("ba nhãn QA-05 chỉ ra đều đi qua next-intl", () => {
    for (const file of files) {
      const source = readFileSync(path.join(repoRoot, file), "utf8");
      assert.doesNotMatch(
        source,
        />\s*Message\s*</,
        `${file}: hardcoded Message`,
      );
      assert.doesNotMatch(
        source,
        /\bin stock\b/,
        `${file}: hardcoded "in stock"`,
      );
      assert.doesNotMatch(source, /:\s*"New"/, `${file}: hardcoded "New"`);
    }
  });

  it("nhãn checkbox danh mục dùng namespace productCategory", () => {
    const source = readFileSync(
      path.join(repoRoot, "src/components/shop/shop-filters.tsx"),
      "utf8",
    );
    assert.match(source, /useTranslations\("productCategory"\)/);
    assert.match(source, /categoryT\(category\)/);
  });
});
