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
    images: z.array(z.object({ url: z.string().url(), publicId: z.string().optional() })),
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
    (data) => data.type !== "BOTH" || (data.price !== undefined && data.rentalPrice !== undefined),
    { message: "Enter both a sale price and a rental price", path: ["price"] },
  );

export type ProductInput = z.infer<typeof productSchema>;
