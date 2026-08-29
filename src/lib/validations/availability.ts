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

const timeString = z.string().regex(/^\d{2}:\d{2}$/);

export const createBlockedDateSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(200).optional(),
    // Both present = only that window is blocked; both absent = the whole
    // day. One-sided (only one of the two set) is rejected below.
    startTime: timeString.optional(),
    endTime: timeString.optional(),
  })
  .refine((v) => (v.startTime == null) === (v.endTime == null), {
    message: "startTime and endTime must both be set, or both omitted",
    path: ["endTime"],
  })
  .refine(
    (v) => v.startTime == null || v.endTime == null || v.startTime < v.endTime,
    { message: "endTime must be after startTime", path: ["endTime"] },
  );

export type CreateBlockedDateInput = z.infer<typeof createBlockedDateSchema>;

export const blockDateRangeSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
});

export type BlockDateRangeInput = z.infer<typeof blockDateRangeSchema>;
