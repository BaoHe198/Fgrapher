import { ProfileCategory } from "@prisma/client";
import { z } from "zod";

export const AMENITY_OPTIONS = [
  "wifi",
  "ac",
  "parking",
  "changing_room",
  "kitchen",
  "restroom",
] as const;

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Enter a display name").optional(),
  description: z.string().max(1000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  instagram: z.string().max(60).optional(),
  facebook: z.string().max(60).optional(),
  tiktok: z.string().max(60).optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  categories: z.array(z.enum(ProfileCategory)).optional(),
  address: z.string().max(200).optional(),
  area: z.number().positive().optional(),
  amenities: z.array(z.enum(AMENITY_OPTIONS)).optional(),
  shopName: z.string().max(120).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
