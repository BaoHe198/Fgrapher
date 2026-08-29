import { ProfileCategory } from "@prisma/client";
import { z } from "zod";

export const createAlbumSchema = z.object({
  profileId: z.string(),
  title: z.string().min(2, "Enter an album title").max(120),
  description: z.string().max(1000).optional(),
  // Required for every NEW album (Prompt G3, VIỆC 1's comment on
  // Album.category — only the one legacy migrated "Ảnh chưa phân loại"
  // album is allowed to have none).
  category: z.enum(ProfileCategory),
  shootDate: z.string().optional(),
});

export type CreateAlbumInput = z.infer<typeof createAlbumSchema>;

export const updateAlbumSchema = z.object({
  title: z.string().min(2, "Enter an album title").max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.enum(ProfileCategory).optional(),
  shootDate: z.string().nullable().optional(),
  coverMediaId: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
});

export type UpdateAlbumInput = z.infer<typeof updateAlbumSchema>;

export const reorderAlbumsSchema = z.object({
  order: z.array(z.string()),
});
