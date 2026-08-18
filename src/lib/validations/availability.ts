import { z } from "zod";

export const weeklyAvailabilitySchema = z.object({
  schedule: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      isActive: z.boolean(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ),
});

export type WeeklyAvailabilityInput = z.infer<typeof weeklyAvailabilitySchema>;

export const createBlockedDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

export type CreateBlockedDateInput = z.infer<typeof createBlockedDateSchema>;
