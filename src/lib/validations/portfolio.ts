import { z } from "zod";

export const createPortfolioMediaSchema = z.object({
  profileId: z.string().min(1),
  albumId: z.string().min(1).optional(),
  url: z.string().url(),
  publicId: z.string().min(1),
  type: z.enum(["IMAGE", "VIDEO"]),
  title: z.string().max(120).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  // Điều 32 Bộ luật Dân sự 2015 — using a person's likeness requires their
  // consent. Required on every upload, never pre-ticked; the server sets
  // ProfileMedia.rightsConfirmedAt itself rather than trusting a client
  // timestamp (see /api/portfolio/route.ts).
  rightsConfirmed: z.boolean().refine((v) => v === true, {
    message: "You must confirm you have the rights to use these images",
  }),
});

export type CreatePortfolioMediaInput = z.infer<
  typeof createPortfolioMediaSchema
>;

export const reorderPortfolioSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export type ReorderPortfolioInput = z.infer<typeof reorderPortfolioSchema>;

// Translated variant — see validations/auth.ts's getLoginSchema comment.
// Namespace "libServices.validation.portfolio".
export function getCreatePortfolioMediaSchema(t: (key: string) => string) {
  return z.object({
    profileId: z.string().min(1),
    albumId: z.string().min(1).optional(),
    url: z.string().url(),
    publicId: z.string().min(1),
    type: z.enum(["IMAGE", "VIDEO"]),
    title: z.string().max(120).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    rightsConfirmed: z.boolean().refine((v) => v === true, {
      message: t("rightsConfirmedRequired"),
    }),
  });
}
