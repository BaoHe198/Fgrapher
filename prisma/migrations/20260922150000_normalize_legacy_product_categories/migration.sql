-- Product.category is a plain String column. Every validator, form and query
-- in the app uses the English codes in src/lib/validations/product.ts, but
-- the seed wrote Vietnamese display labels into it, and nothing rejected
-- them. Those rows then fell out of any query that filters on the canonical
-- list: Văn Long Camera's five products appeared on /shop and in
-- /dashboard/listings, while the Sản phẩm tab of its own public profile said
-- the shop had posted nothing at all (QA-04, 22/09/2026).
--
-- One canonical spelling from here on. The mapping is the same one
-- LEGACY_PRODUCT_CATEGORY_ALIASES holds in code, which stays as a runtime
-- safety net for any row this statement does not know about.
--
-- Rollback (restores the labels this statement rewrote; harmless if some
-- rows were already canonical before, since those are indistinguishable by
-- design — the label carries no other information):
--
--   UPDATE "products" SET "category" = 'Thân máy'        WHERE "category" = 'Camera body';
--   UPDATE "products" SET "category" = 'Ống kính'        WHERE "category" = 'Lens';
--   UPDATE "products" SET "category" = 'Ánh sáng'        WHERE "category" = 'Lighting';
--   UPDATE "products" SET "category" = 'Âm thanh'        WHERE "category" = 'Audio';
--   UPDATE "products" SET "category" = 'Phụ kiện hỗ trợ' WHERE "category" = 'Support';
--   UPDATE "products" SET "category" = 'Phụ kiện'        WHERE "category" = 'Accessory';
--   UPDATE "products" SET "category" = 'Khác'            WHERE "category" = 'Other';
UPDATE "products"
SET "category" = CASE "category"
  WHEN 'Thân máy'        THEN 'Camera body'
  WHEN 'Ống kính'        THEN 'Lens'
  WHEN 'Ánh sáng'        THEN 'Lighting'
  WHEN 'Âm thanh'        THEN 'Audio'
  WHEN 'Phụ kiện hỗ trợ' THEN 'Support'
  WHEN 'Phụ kiện'        THEN 'Accessory'
  WHEN 'Khác'            THEN 'Other'
  ELSE "category"
END
WHERE "category" IN (
  'Thân máy', 'Ống kính', 'Ánh sáng', 'Âm thanh',
  'Phụ kiện hỗ trợ', 'Phụ kiện', 'Khác'
);
