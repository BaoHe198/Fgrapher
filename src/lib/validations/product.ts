import { z } from "zod";

export const PRODUCT_CATEGORIES = [
  "Camera body",
  "Lens",
  "Lighting",
  "Audio",
  "Support",
  "Accessory",
  "Other",
] as const;

export const productSchema = z
  .object({
    name: z.string().min(2, "Enter a product name"),
    description: z.string().optional(),
    category: z.enum(PRODUCT_CATEGORIES),
    type: z.enum(["SALE", "RENT", "BOTH"]),
    price: z.number().positive().optional(),
    rentalPrice: z.number().positive().optional(),
    depositAmount: z.number().min(0).optional(),
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
    stock: z.number().int().min(0),
    isActive: z.boolean(),
    images: z.array(
      z.object({ url: z.string().url(), publicId: z.string().optional() }),
    ),
  })
  .refine((data) => data.type !== "SALE" || data.price !== undefined, {
    message: "Enter a sale price",
    path: ["price"],
  })
  .refine((data) => data.type !== "RENT" || data.rentalPrice !== undefined, {
    message: "Enter a rental price per day",
    path: ["rentalPrice"],
  })
  .refine(
    (data) =>
      data.type !== "BOTH" ||
      (data.price !== undefined && data.rentalPrice !== undefined),
    { message: "Enter both a sale price and a rental price", path: ["price"] },
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
      price: z.number().positive().optional(),
      rentalPrice: z.number().positive().optional(),
      depositAmount: z.number().min(0).optional(),
      condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
      stock: z.number().int().min(0),
      isActive: z.boolean(),
      images: z.array(
        z.object({ url: z.string().url(), publicId: z.string().optional() }),
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
