import type { Role } from "@prisma/client";
import { z } from "zod";
import { MAX_VND_AMOUNT } from "@/lib/validations/money";

export const CAMERA_PRODUCT_CATEGORIES = [
  "Camera body",
  "Lens",
  "Lighting",
  "Audio",
  "Support",
  "Accessory",
  "Other",
] as const;

// Chợ F lists photo/video EQUIPMENT only (project owner, 21/09/2026,
// reconfirmed 22/09/2026 over the branch that had briefly reopened it to
// outfits). A costume shop is not a seller here at all — its outfits live on
// its own profile as a CostumeItem catalogue — so there is one category list,
// not one per role.
export const PRODUCT_CATEGORIES = CAMERA_PRODUCT_CATEGORIES;

export type ProductCategory = (typeof CAMERA_PRODUCT_CATEGORIES)[number];

/**
 * Category strings that exist in the database but are not values a client
 * can send, mapped to what they mean.
 *
 * Product.category is a plain String column, and the seed wrote Vietnamese
 * display labels into it ("Thân máy", "Ống kính", …) while every validator,
 * form and query here has always used the English codes above. Nothing
 * rejected the mismatch, so the rows simply fell out of any query that
 * filtered on the canonical list: Văn Long Camera's five products showed up
 * on /shop and in /dashboard/listings, and the Sản phẩm tab of its own
 * public profile said the shop had posted nothing (QA-04, 22/09/2026).
 *
 * 20260922150000_normalize_legacy_product_categories rewrites the rows, so
 * this map should have nothing left to do on a migrated database. It stays
 * because a String column with no constraint has no way to prove that, and
 * because a query that quietly drops rows is exactly how this went unnoticed
 * for as long as it did.
 */
export const LEGACY_PRODUCT_CATEGORY_ALIASES: Record<string, ProductCategory> =
  {
    "Thân máy": "Camera body",
    "Ống kính": "Lens",
    "Ánh sáng": "Lighting",
    "Âm thanh": "Audio",
    "Phụ kiện hỗ trợ": "Support",
    "Phụ kiện": "Accessory",
    Khác: "Other",
  };

/** The canonical value a stored category means, or null if unrecognised. */
export function normalizeProductCategory(
  value: string,
): ProductCategory | null {
  if ((CAMERA_PRODUCT_CATEGORIES as readonly string[]).includes(value)) {
    return value as ProductCategory;
  }
  return LEGACY_PRODUCT_CATEGORY_ALIASES[value] ?? null;
}

/**
 * Kept as a per-role function even though every seller role currently gets
 * the same list: the two product routes validate the category against the
 * seller's role server-side, and that guard should not have to change shape
 * the day a role does get its own categories.
 */
export function productCategoriesForRole(_role: Role) {
  return CAMERA_PRODUCT_CATEGORIES;
}

/**
 * Every string a `category` filter should accept for these canonical
 * categories — the canonical values plus any legacy label that means one of
 * them. For WHERE clauses only; never offer these as choices.
 */
export function productCategoryQueryValues(
  categories: readonly string[],
): string[] {
  const wanted = new Set(categories);
  const aliases = Object.entries(LEGACY_PRODUCT_CATEGORY_ALIASES)
    .filter(([, canonical]) => wanted.has(canonical))
    .map(([legacy]) => legacy);
  return [...new Set([...categories, ...aliases])];
}

export function productCategoryAllowedForRole(role: Role, category: string) {
  return (productCategoriesForRole(role) as readonly string[]).includes(
    category,
  );
}

// English messages for server logs and any caller without a translator.
const PRODUCT_MESSAGES_EN: Record<string, string> = {
  nameRequired: "Enter a product name",
  salePriceRequired: "Enter a sale price",
  rentalPriceRequired: "Enter a rental price per day",
  bothPricesRequired: "Enter both a sale price and a rental price",
  amountTooHigh: "That amount is too large",
};

export const productSchema = getProductSchema(
  (key) => PRODUCT_MESSAGES_EN[key] ?? key,
);

export type ProductInput = z.infer<typeof productSchema>;

// Translated variant — see validations/auth.ts's getLoginSchema comment.
// Namespace "libServices.validation.product". Marketplace/shop is
// currently hidden behind the CAMERA_SHOP feature flag (out of MVP scope
// per CLAUDE.md), but kept translated for when it's re-enabled.
export function getProductSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(2, t("nameRequired")),
      description: z.string().optional(),
      category: z.enum(PRODUCT_CATEGORIES),
      type: z.enum(["SALE", "RENT", "BOTH"]),
      price: z
        .number()
        .positive()
        .max(MAX_VND_AMOUNT, t("amountTooHigh"))
        .optional(),
      rentalPrice: z
        .number()
        .positive()
        .max(MAX_VND_AMOUNT, t("amountTooHigh"))
        .optional(),
      depositAmount: z
        .number()
        .min(0)
        .max(MAX_VND_AMOUNT, t("amountTooHigh"))
        .optional(),
      condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
      stock: z.number().int().min(0),
      isActive: z.boolean(),
      images: z.array(
        z.object({ url: z.string().url(), publicId: z.string().min(1) }),
      ),
    })
    .refine((data) => data.type !== "SALE" || data.price !== undefined, {
      message: t("salePriceRequired"),
      path: ["price"],
    })
    .refine((data) => data.type !== "RENT" || data.rentalPrice !== undefined, {
      message: t("rentalPriceRequired"),
      path: ["rentalPrice"],
    })
    .refine(
      (data) =>
        data.type !== "BOTH" ||
        (data.price !== undefined && data.rentalPrice !== undefined),
      { message: t("bothPricesRequired"), path: ["price"] },
    );
}
