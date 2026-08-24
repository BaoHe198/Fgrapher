import { Role } from "@prisma/client";
import { z } from "zod";

// EXPIRED is deliberately excluded — that transition only ever happens
// via the /api/cron/expire-bookings cron (system actor), never a human
// request; see services/bookings.ts's transitionBooking.
export const updateBookingStatusSchema = z.object({
  status: z.enum([
    "CONFIRMED",
    "DECLINED",
    "CANCELLED",
    "COMPLETED",
    "NO_SHOW",
  ]),
  cancelReason: z.string().max(500).optional(),
});

export type UpdateBookingStatusInput = z.infer<
  typeof updateBookingStatusSchema
>;

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
  // Crew-hire (Prompt B7, VIỆC 1) — "Gắn vào đơn khách hàng".
  parentBookingId: z.string().min(1).optional(),
  // Which of the requester's own roles they're booking as — "CUSTOMER"
  // for a normal booking, or their provider role (e.g. "PHOTOGRAPHER")
  // when attaching to a parentBookingId. recipientRole is never accepted
  // from the client — services/bookings.ts derives it server-side from
  // the service's own profile role.
  requesterRole: z.enum(Role).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const proposeRescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Invalid time")
    .optional(),
});

export type ProposeRescheduleInput = z.infer<typeof proposeRescheduleSchema>;

export const respondRescheduleSchema = z.object({
  accept: z.boolean(),
});

// Translated variants — see validations/auth.ts's getLoginSchema comment
// for why these are factories rather than bare schemas. Namespace
// "libServices.validation.booking".
export function getCreateBookingSchema(t: (key: string) => string) {
  return z.object({
    providerId: z.string().min(1),
    serviceId: z.string().min(1).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("invalidDate")),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, t("invalidTime")),
    locationType: locationTypeSchema,
    locationAddress: z.string().max(300).optional(),
    numberOfPeople: z.coerce.number().int().min(1).max(999).optional(),
    notes: z.string().max(1000).optional(),
    contactPhone: z.string().max(30).optional(),
    referenceImages: z.array(z.string().url()).max(5).optional(),
    parentBookingId: z.string().min(1).optional(),
    requesterRole: z.enum(Role).optional(),
  });
}

export function getProposeRescheduleSchema(t: (key: string) => string) {
  return z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("invalidDate")),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, t("invalidTime")),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, t("invalidTime"))
      .optional(),
  });
}
