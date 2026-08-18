import { z } from "zod";

export const createPortfolioMediaSchema = z.object({
  profileId: z.string().min(1),
  url: z.string().url(),
  publicId: z.string().min(1),
  type: z.enum(["IMAGE", "VIDEO"]),
  title: z.string().max(120).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type CreatePortfolioMediaInput = z.infer<typeof createPortfolioMediaSchema>;

export const reorderPortfolioSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export type ReorderPortfolioInput = z.infer<typeof reorderPortfolioSchema>;
