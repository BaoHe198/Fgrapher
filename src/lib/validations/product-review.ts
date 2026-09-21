import { z } from "zod";

export const createProductReviewSchema = z.object({
  orderId: z.string().min(1),
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  content: z.string().max(1000).optional(),
});

export type CreateProductReviewInput = z.infer<
  typeof createProductReviewSchema
>;
