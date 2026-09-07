import { z } from "zod";

import { PAID_ROLE_VALUES } from "@/lib/validations/auth";

// One role per payment intent, not an array like Stripe's checkoutSchema
// — the one-active-paid-role-per-account rule (CLAUDE.md) means
// multi-role checkout never applies to any of these three rails.
export const createPaymentIntentSchema = z.object({
  role: z.enum(PAID_ROLE_VALUES),
  interval: z.enum(["month", "year"]),
});

// Bank transfer is two-phase like MoMo/ZaloPay (create intent -> submit
// proof), just without a redirect in between — createPaymentIntentSchema
// above covers the create step, this covers the submit step.
export const submitBankTransferProofSchema = z.object({
  paymentId: z.string().min(1),
  proofUrl: z.string().url(),
});

export const reviewPaymentSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().max(500).optional(),
  }),
]);
