import { Role } from "@prisma/client";
import { z } from "zod";

export const adminUserActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    reason: z.string().min(1),
    until: z.string().optional(),
  }),
  z.object({ action: z.literal("unsuspend") }),
  z.object({ action: z.literal("verify") }),
  z.object({ action: z.literal("delete") }),
  z.object({ action: z.literal("notes"), notes: z.string().max(2000) }),
  // Manual plan assignment while BILLING_ENABLED=false — see CLAUDE.md
  // and services/subscription.ts's assignManualPlan.
  z.object({
    action: z.literal("assign_plan"),
    role: z.enum(Role),
    plan: z.string().min(1).max(40),
    expiresAt: z.string().min(1),
    note: z.string().max(1000).optional(),
  }),
]);

export const resolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED", "REVIEWING"]),
  note: z.string().max(1000).optional(),
});

export const reviewVerificationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1) }),
]);

export const processDataRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("reject"), note: z.string().min(1) }),
]);
