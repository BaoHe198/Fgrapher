import { ProfileCategory } from "@prisma/client";
import { z } from "zod";

import { vietnamDateKey } from "@/lib/vietnam/date";
import { locationTypeSchema } from "@/lib/validations/booking";
import { MAX_VND_AMOUNT } from "@/lib/validations/money";
import {
  MAX_REFERENCE_MEDIA,
  referenceMediaUrlSchema,
} from "@/lib/validations/reference-media";

const serviceRequestFields = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  // Requests target bookable creative services. Shops are contacted from a
  // product listing, while CUSTOMER/ADMIN are never request recipients.
  role: z.enum([
    "PHOTOGRAPHER",
    "VIDEOGRAPHER",
    "MAKEUP_ARTIST",
    "STUDIO",
    "MODEL",
  ]),
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
  budgetMin: z.coerce.number().positive().max(MAX_VND_AMOUNT).optional(),
  budgetMax: z.coerce.number().positive().max(MAX_VND_AMOUNT).optional(),
  // Photos or videos (mediaUrl holds either — see lib/media/kind.ts). Only
  // Cloudinary delivery URLs: these are rendered for every provider who
  // opens the request, so an arbitrary URL here would be loaded into all of
  // their browsers. The upload field only ever produces Cloudinary URLs.
  references: z
    .array(
      z.object({
        mediaUrl: referenceMediaUrlSchema,
        publicId: z.string().min(1),
      }),
    )
    // Shared with the booking schema — a request's references become the
    // booking's when an offer is accepted. See validations/reference-media.ts.
    .max(MAX_REFERENCE_MEDIA)
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

/**
 * What is wrong with the "when" of a request that is about to go to review:
 * no date at all, or a date that has already passed. A draft is exempt (it
 * may be saved half-filled, and one saved last week may by now hold a past
 * date); the rule bites when the request is posted — on create and on
 * publishing a draft, which has no request body and so never met the schema.
 * Both are "YYYY-MM-DD", which compares correctly as text.
 */
export function requestDateProblem(
  data: {
    shootDate?: string | null;
    isDateFlexible?: boolean;
    dateRangeEnd?: string | null;
  },
  today = vietnamDateKey(),
): "missing" | "past" | null {
  if (!data.isDateFlexible && !data.shootDate) return "missing";
  // A flexible request is about its window when it has one; the exact date
  // is then only the middle of it ("± 3 ngày") and may already be behind.
  const lastUsableDay = data.isDateFlexible
    ? (data.dateRangeEnd ?? data.shootDate)
    : data.shootDate;
  if (lastUsableDay && lastUsableDay < today) return "past";
  return null;
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
  .refine((data) => data.isDraft || requestDateProblem(data) !== "missing", {
    message: "Hãy chọn ngày chụp, hoặc đánh dấu ngày linh hoạt",
    path: ["shootDate"],
  })
  // The wizard's date field has min=today, but that is only the browser: a
  // request for last week went straight to the review queue.
  .refine((data) => data.isDraft || requestDateProblem(data) !== "past", {
    message: "Ngày chụp đã qua — hãy chọn một ngày từ hôm nay trở đi",
    path: ["shootDate"],
  })
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
  proposedPrice: z.coerce.number().positive().max(MAX_VND_AMOUNT),
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
