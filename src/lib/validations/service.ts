import { z } from "zod";

export const createServiceSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(2, "Enter a service name"),
  description: z.string().max(500).optional(),
  // Kept server-side only: one booking occupies this many minutes of the
  // provider's calendar. Providers no longer set it (project owner,
  // 21/09/2026) — they state the timing in the description instead.
  duration: z.number().int().positive().default(60),
  price: z.number().positive("Enter a price"),
  isActive: z.boolean().default(true),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema
  .omit({ profileId: true })
  .partial();

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

// Translated variants — see validations/auth.ts's getLoginSchema comment.
// Namespace "libServices.validation.service".
export function getCreateServiceSchema(t: (key: string) => string) {
  return z.object({
    profileId: z.string().min(1),
    name: z.string().min(2, t("nameRequired")),
    description: z.string().max(500).optional(),
    // Kept server-side only: one booking occupies this many minutes of the
    // provider's calendar. Providers no longer set it (project owner,
    // 21/09/2026) — they state the timing in the description instead.
    duration: z.number().int().positive().default(60),
    price: z.number().positive(t("priceRequired")),
    isActive: z.boolean().default(true),
  });
}

export function getUpdateServiceSchema(t: (key: string) => string) {
  return getCreateServiceSchema(t).omit({ profileId: true }).partial();
}
