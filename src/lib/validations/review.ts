import { z } from "zod";

import { REPORT_REASONS } from "@/lib/constants";

export const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(20, "Share a bit more detail (at least 20 characters)").max(1000),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().min(20).max(1000),
});

export const respondSchema = z.object({
  response: z.string().min(1).max(500),
});

export const reportSchema = z.object({
  targetType: z.enum(["review", "user", "message", "product"]),
  targetId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  description: z.string().max(1000).optional(),
});
