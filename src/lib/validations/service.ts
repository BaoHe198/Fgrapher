import { z } from "zod";

export const createServiceSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(2, "Enter a service name"),
  description: z.string().max(500).optional(),
  duration: z.number().int().positive("Enter a duration in minutes"),
  price: z.number().positive("Enter a price"),
  isActive: z.boolean().default(true),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.omit({ profileId: true }).partial();

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
