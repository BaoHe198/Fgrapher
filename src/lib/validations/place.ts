import {
  PlaceKind,
  PlaceOperatingStatus,
  ProfileCategory,
} from "@prisma/client";
import { z } from "zod";

import {
  MAX_PLACE_PHOTOS,
  PLACE_CATEGORIES,
  VIETNAM_BOUNDS,
} from "@/lib/places";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const placePhotoSchema = z.object({
  url: z.url().max(500),
  publicId: z.string().min(1).max(300),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  caption: optionalText(200),
});

export type PlacePhotoInput = z.infer<typeof placePhotoSchema>;

const monthsSchema = z
  .array(z.number().int().min(1).max(12))
  .max(12)
  .transform((months) => [...new Set(months)].sort((a, b) => a - b));

/** The facts of a spot — shared by a provider's proposal and an admin's edit. */
export const placeFieldsSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(30).max(3000),
  kind: z.enum(PlaceKind),
  categories: z
    .array(z.enum(ProfileCategory))
    .max(PLACE_CATEGORIES.length)
    .refine(
      (values) => values.every((value) => PLACE_CATEGORIES.includes(value)),
      "Not a shoot style a place can suit",
    )
    .transform((values) => [...new Set(values)]),
  provinceId: z.string().min(1).max(64),
  wardId: z.string().min(1).max(64).nullable().optional(),
  address: optionalText(300),
  latitude: z.number().min(VIETNAM_BOUNDS.south).max(VIETNAM_BOUNDS.north),
  longitude: z.number().min(VIETNAM_BOUNDS.west).max(VIETNAM_BOUNDS.east),
  bestTimeNote: optionalText(300),
  bestMonths: monthsSchema.default([]),
  entryFeeVnd: z.number().int().min(0).max(10_000_000).nullable().optional(),
  feeNote: optionalText(500),
  permitRequired: z.boolean().nullable().optional(),
  rulesNote: optionalText(500),
  crowdNote: optionalText(300),
  parkingNote: optionalText(300),
});

export type PlaceFieldsInput = z.infer<typeof placeFieldsSchema>;

/**
 * A provider's proposal. Photos: at least one, all confirmed as the
 * uploader's own (Điều 32 BLDS — the same checkbox as a portfolio upload).
 * `keepPhotoIds` lists photos already on the spot to keep when editing a
 * proposal that is still waiting or was sent back.
 */
export const placeProposalSchema = placeFieldsSchema.extend({
  photos: z.array(placePhotoSchema).max(MAX_PLACE_PHOTOS).default([]),
  keepPhotoIds: z.array(z.string().min(1)).max(MAX_PLACE_PHOTOS).default([]),
  rightsConfirmed: z.literal(true),
  /** The proposer saw the nearby spots and says this is a different one. */
  notDuplicate: z.boolean().default(false),
});

export type PlaceProposalInput = z.infer<typeof placeProposalSchema>;

/** An admin's edit of any spot, whatever its review state. */
export const adminPlaceUpdateSchema = placeFieldsSchema.partial().extend({
  // No default here: a status-only update must leave the months alone. With
  // the default, every "Lưu tình trạng" wiped them (found 20/11/2026).
  bestMonths: monthsSchema.optional(),
  operatingStatus: z.enum(PlaceOperatingStatus).optional(),
  statusNote: optionalText(300),
  /** "Đã kiểm tra thông tin hôm nay" — stamps lastVerifiedAt. */
  markVerified: z.boolean().optional(),
});

export type AdminPlaceUpdateInput = z.infer<typeof adminPlaceUpdateSchema>;

/** An admin adding a spot directly (the starter set). */
export const adminPlaceCreateSchema = placeFieldsSchema.extend({
  photos: z.array(placePhotoSchema).max(30).default([]),
  rightsConfirmed: z.literal(true),
});

export const placeReviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(5).max(500),
  }),
]);

export const placeMediaModerationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    mediaIds: z.array(z.string().min(1)).min(1).max(50),
  }),
  z.object({
    action: z.literal("reject"),
    mediaIds: z.array(z.string().min(1)).min(1).max(50),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({ action: z.literal("cover"), mediaId: z.string().min(1) }),
  z.object({
    action: z.literal("add"),
    photos: z.array(placePhotoSchema).min(1).max(30),
    rightsConfirmed: z.literal(true),
  }),
]);

export const placeMergeSchema = z.object({
  intoPlaceId: z.string().min(1),
});

const coordinate = z.coerce.number().finite();

export const placeMapSchema = z
  .object({
    north: coordinate.min(-90).max(90),
    south: coordinate.min(-90).max(90),
    east: coordinate.min(-180).max(180),
    west: coordinate.min(-180).max(180),
    kinds: z.array(z.enum(PlaceKind)).max(20).default([]),
    categories: z.array(z.enum(ProfileCategory)).max(20).default([]),
  })
  .refine((value) => value.north > value.south && value.east > value.west, {
    message: "Invalid map bounds",
  })
  .refine(
    (value) => value.north - value.south <= 20 && value.east - value.west <= 20,
    { message: "Map area is too large" },
  );

export const placeSearchSchema = z.object({
  q: z.string().trim().min(1).max(80),
});

export const placeNearbySchema = z.object({
  latitude: coordinate.min(VIETNAM_BOUNDS.south).max(VIETNAM_BOUNDS.north),
  longitude: coordinate.min(VIETNAM_BOUNDS.west).max(VIETNAM_BOUNDS.east),
  excludeId: z.string().min(1).max(64).optional(),
});
