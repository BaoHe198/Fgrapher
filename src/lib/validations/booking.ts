import { z } from "zod";

export const updateBookingStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "DECLINED", "CANCELLED", "COMPLETED"]),
  cancelReason: z.string().optional(),
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
