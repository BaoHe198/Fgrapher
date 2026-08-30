import { ProfileCategory, Role } from "@prisma/client";
import { z } from "zod";

import { locationTypeSchema } from "@/lib/validations/booking";

const serviceRequestFields = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  role: z.enum(Role),
  categories: z.array(z.enum(ProfileCategory)).max(5).default([]),
  shootDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  isDateFlexible: z.boolean().default(false),
  dateRangeStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateRangeEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  provinceId: z.string().min(1),
  // Nullable (not just optional) — switching province in the wizard resets
  // the selected ward, and that reset must reach the DB as an explicit
  // clear, not a skipped field, or a saved draft can end up with a wardId
  // from a province the request no longer points to.
  wardId: z.string().nullable().optional(),
  areaNote: z.string().max(120).optional(),
  detailedAddress: z.string().max(300).optional(),
  budgetMin: z.coerce.number().positive().optional(),
  budgetMax: z.coerce.number().positive().optional(),
  references: z
    .array(
      z.object({ mediaUrl: z.string().url(), publicId: z.string().optional() }),
    )
    .max(10)
    .optional(),
  isDraft: z.boolean().default(false),
});

export const createServiceRequestSchema = serviceRequestFields.refine(
  (data) => data.isDraft || data.isDateFlexible || Boolean(data.shootDate),
  {
    message: "Choose a shoot date, or mark the date as flexible",
    path: ["shootDate"],
  },
);

export type CreateServiceRequestInput = z.infer<
  typeof createServiceRequestSchema
>;

export const updateDraftServiceRequestSchema = serviceRequestFields.partial();

export const createOfferSchema = z.object({
  message: z.string().max(1000).optional(),
  proposedPrice: z.coerce.number().positive(),
  proposedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const acceptOfferSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  locationType: locationTypeSchema,
});
