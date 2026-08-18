import { z } from "zod";

export const updateBookingStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "DECLINED", "CANCELLED", "COMPLETED", "NO_SHOW"]),
  cancelReason: z.string().max(500).optional(),
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

export const locationTypeSchema = z.enum(["PROVIDER", "CUSTOMER", "OUTDOOR"]);

export const createBookingSchema = z.object({
  providerId: z.string().min(1),
  serviceId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
  locationType: locationTypeSchema,
  locationAddress: z.string().max(300).optional(),
  numberOfPeople: z.coerce.number().int().min(1).max(999).optional(),
  notes: z.string().max(1000).optional(),
  contactPhone: z.string().max(30).optional(),
  referenceImages: z.array(z.string().url()).max(5).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const proposeRescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time").optional(),
});

export type ProposeRescheduleInput = z.infer<typeof proposeRescheduleSchema>;

export const respondRescheduleSchema = z.object({
  accept: z.boolean(),
});
