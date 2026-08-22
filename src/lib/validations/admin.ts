import { z } from "zod";

export const adminUserActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), reason: z.string().min(1), until: z.string().optional() }),
  z.object({ action: z.literal("unsuspend") }),
  z.object({ action: z.literal("verify") }),
  z.object({ action: z.literal("delete") }),
  z.object({ action: z.literal("notes"), notes: z.string().max(2000) }),
]);

export const resolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED", "REVIEWING"]),
  note: z.string().max(1000).optional(),
});

export const reviewVerificationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1) }),
]);
