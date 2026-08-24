import { Role } from "@prisma/client";
import { z } from "zod";

// Prompt B4, VIỆC 4 — "báo tôi khi có nhà cung cấp ở khu vực này", captured
// from /browse's empty state when a province+role search comes up thin.
export const createWaitlistEntrySchema = z.object({
  email: z.string().email("Enter a valid email"),
  provinceId: z.string().min(1, "Province is required"),
  role: z.enum(Role),
});

export type CreateWaitlistEntryInput = z.infer<
  typeof createWaitlistEntrySchema
>;
