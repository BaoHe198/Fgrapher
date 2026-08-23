import { z } from "zod";

// SERVICE consent is mandatory (enforced at registration, see
// registerSchema) and is never toggleable afterward from this endpoint —
// withdrawing it is handled through account deletion instead.
export const updateConsentSchema = z.object({
  purpose: z.enum(["MARKETING", "ANALYTICS"]),
  granted: z.boolean(),
});

export type UpdateConsentInput = z.infer<typeof updateConsentSchema>;
