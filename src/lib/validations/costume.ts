import { z } from "zod";

// The eight costume categories a costume shop can tag an outfit with. Same
// values as the COSTUME_SHOP entry of CATEGORIES_BY_ROLE — they are
// ProfileCategory enum members, so the shop's profile categories and its
// catalogue speak the same language.
export const COSTUME_CATEGORIES = [
  "AO_DAI",
  "WEDDING_DRESS",
  "MENSWEAR",
  "EVENING_GOWN",
  "HISTORICAL",
  "COSPLAY",
  "KIDSWEAR",
  "ACCESSORIES",
] as const;

export const createCostumeSchema = z.object({
  profileId: z.string().min(1),
  mediaId: z.string().min(1).nullish(),
  name: z.string().min(2, "Enter an outfit name"),
  description: z.string().max(1000).optional(),
  category: z.enum(COSTUME_CATEGORIES).nullish(),
  rentalPricePerDay: z.number().positive("Enter a daily rental price"),
  // Optional: a shop may take no deposit at all. 0 and null both mean "no
  // deposit"; the shop collects whatever it sets directly.
  depositAmount: z.number().nonnegative().max(1_000_000_000).nullish(),
  size: z.string().max(60).optional(),
  color: z.string().max(60).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export type CreateCostumeInput = z.infer<typeof createCostumeSchema>;

export const updateCostumeSchema = createCostumeSchema
  .omit({ profileId: true })
  .partial();

export type UpdateCostumeInput = z.infer<typeof updateCostumeSchema>;
