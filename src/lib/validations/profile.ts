import { ExperienceLevel, ProfileCategory } from "@prisma/client";
import { z } from "zod";

import { isValidZaloUrl, normalizeZaloUrl } from "@/lib/zalo";

export const AMENITY_OPTIONS = [
  "wifi",
  "ac",
  "parking",
  "changing_room",
  "kitchen",
  "restroom",
] as const;

function zaloUrlSchema(message: string) {
  return z
    .string()
    .trim()
    .max(300)
    .refine(isValidZaloUrl, message)
    .transform(normalizeZaloUrl)
    .nullable()
    .optional();
}

// Coordinates of an address the provider picked from the autocomplete
// list. Bounded to Vietnam; it only ever places the provider's own marker.
const addressPointSchema = z
  .object({
    latitude: z.number().min(8).max(24),
    longitude: z.number().min(102).max(110),
  })
  .optional();

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Enter a display name").optional(),
  description: z.string().max(1000).optional(),
  website: z.string().url().optional().or(z.literal("")),
  instagram: z.string().max(60).optional(),
  facebook: z.string().max(60).optional(),
  tiktok: z.string().max(60).optional(),
  zaloUrl: zaloUrlSchema("Enter an official https://zalo.me link"),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  categories: z.array(z.enum(ProfileCategory)).optional(),
  address: z.string().trim().min(5).max(200),
  addressPoint: addressPointSchema,
  area: z.number().positive().optional(),
  amenities: z.array(z.enum(AMENITY_OPTIONS)).optional(),
  shopName: z.string().max(120).optional(),
  // Model-specific — see prisma/schema.prisma's Profile model comment.
  height: z.number().int().positive().max(300).optional(),
  measurements: z.string().max(60).optional(),
  hairColor: z.string().max(40).optional(),
  eyeColor: z.string().max(40).optional(),
  shoeSize: z.string().max(20).optional(),
  experienceLevel: z.enum(ExperienceLevel).optional(),
  travelWilling: z.boolean().optional(),
  agencyRepresented: z.boolean().optional(),
  agencyName: z.string().max(120).optional(),
  hideExactLocation: z.boolean().optional(),
  requireDepositBeforeContact: z.boolean().optional(),
  provinceId: z.string().min(1),
  wardId: z.string().min(1),
  servesNationwide: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Extra service-area provinces (Prompt B4 VIỆC 3) — not a scalar Profile
// column (ProfileServiceArea is a separate join table), so kept as its own
// schema and handled specially by the API route rather than folded into
// updateProfileSchema's generic upsert.
export const updateServiceAreasSchema = z.object({
  provinceIds: z.array(z.string()),
});

// Translated variant — see validations/auth.ts's getLoginSchema comment.
// Namespace "libServices.validation.profile".
export function getUpdateProfileSchema(t: (key: string) => string) {
  return z.object({
    displayName: z.string().min(2, t("displayNameRequired")).optional(),
    description: z.string().max(1000).optional(),
    website: z.string().url().optional().or(z.literal("")),
    instagram: z.string().max(60).optional(),
    facebook: z.string().max(60).optional(),
    tiktok: z.string().max(60).optional(),
    zaloUrl: zaloUrlSchema(t("zaloUrlInvalid")),
    priceMin: z.number().nonnegative().optional(),
    priceMax: z.number().nonnegative().optional(),
    categories: z.array(z.enum(ProfileCategory)).optional(),
    address: z.string().trim().min(5, t("addressRequired")).max(200),
    addressPoint: addressPointSchema,
    area: z.number().positive().optional(),
    amenities: z.array(z.enum(AMENITY_OPTIONS)).optional(),
    shopName: z.string().max(120).optional(),
    height: z.number().int().positive().max(300).optional(),
    measurements: z.string().max(60).optional(),
    hairColor: z.string().max(40).optional(),
    eyeColor: z.string().max(40).optional(),
    shoeSize: z.string().max(20).optional(),
    experienceLevel: z.enum(ExperienceLevel).optional(),
    travelWilling: z.boolean().optional(),
    agencyRepresented: z.boolean().optional(),
    agencyName: z.string().max(120).optional(),
    hideExactLocation: z.boolean().optional(),
    requireDepositBeforeContact: z.boolean().optional(),
    provinceId: z.string().min(1, t("provinceRequired")),
    wardId: z.string().min(1, t("wardRequired")),
    servesNationwide: z.boolean().optional(),
  });
}
