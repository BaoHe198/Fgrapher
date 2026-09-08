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

// Applied to both the create and draft-update schemas below (not just
// final submit) — a "draft" is still meant to resume to a coherent form
// later, and QA found a swapped min/max or date range could otherwise be
// saved via "Lưu nháp" and only surface as garbage once the wizard's
// review step (or a provider reading the published request) tried to
// display it. Only fires when BOTH sides of a pair are present, so an
// intentionally-incomplete draft (only one of the two fields filled in)
// is never blocked.
function budgetOrderValid(data: { budgetMin?: number; budgetMax?: number }) {
  if (data.budgetMin === undefined || data.budgetMax === undefined) {
    return true;
  }
  return data.budgetMin <= data.budgetMax;
}

function dateRangeOrderValid(data: {
  dateRangeStart?: string;
  dateRangeEnd?: string;
}) {
  if (!data.dateRangeStart || !data.dateRangeEnd) return true;
  // Both are "YYYY-MM-DD" (regex-validated above), which compares
  // correctly lexicographically — no Date parsing needed.
  return data.dateRangeStart <= data.dateRangeEnd;
}

function budgetOrderIssue() {
  return {
    message: "Ngân sách tối thiểu không được lớn hơn ngân sách tối đa",
    path: ["budgetMax"],
  };
}

function dateRangeOrderIssue() {
  return {
    message: "Ngày bắt đầu không được sau ngày kết thúc",
    path: ["dateRangeEnd"],
  };
}

export const createServiceRequestSchema = serviceRequestFields
  .refine(
    (data) => data.isDraft || data.isDateFlexible || Boolean(data.shootDate),
    {
      message: "Choose a shoot date, or mark the date as flexible",
      path: ["shootDate"],
    },
  )
  .refine(budgetOrderValid, budgetOrderIssue())
  .refine(dateRangeOrderValid, dateRangeOrderIssue());

export type CreateServiceRequestInput = z.infer<
  typeof createServiceRequestSchema
>;

export const updateDraftServiceRequestSchema = serviceRequestFields
  .partial()
  .refine(budgetOrderValid, budgetOrderIssue())
  .refine(dateRangeOrderValid, dateRangeOrderIssue());

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
