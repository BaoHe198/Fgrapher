import { z } from "zod";

import { isAtLeast18 } from "@/lib/age-gate";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Kept in sync with PAID_ROLES in @/lib/constants — hardcoded here (rather
// than derived) since zod needs a literal tuple for z.enum.
const PAID_ROLE_VALUES = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "CAMERA_SHOP",
  "MODEL",
] as const;

export type ProviderRole = (typeof PAID_ROLE_VALUES)[number];

export const registerSchema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    accountType: z.enum(["customer", "provider"]),
    roles: z.array(z.enum(PAID_ROLE_VALUES)),
    // Age gate (docs/guides/fgrapher-prompts-batch-2.md §3b) — required
    // only when MODEL is selected. Stored privately on User; never
    // returned to the client or displayed, only used to compute a public
    // age range (see lib/age-gate.ts's getAgeRangeLabel).
    dateOfBirth: z.string().optional(),
    // Content guidelines acceptance (§3b item 3) — required only when
    // MODEL is selected.
    acceptedContentGuidelines: z.boolean().optional(),
  })
  .refine((data) => data.accountType !== "provider" || data.roles.length > 0, {
    message: "Select at least one role",
    path: ["roles"],
  })
  .refine((data) => !data.roles.includes("MODEL") || Boolean(data.dateOfBirth), {
    message: "Date of birth is required for the Model role",
    path: ["dateOfBirth"],
  })
  .refine(
    (data) => !data.roles.includes("MODEL") || !data.dateOfBirth || isAtLeast18(new Date(data.dateOfBirth)),
    { message: "You must be at least 18 to register as a Model", path: ["dateOfBirth"] },
  )
  .refine((data) => !data.roles.includes("MODEL") || data.acceptedContentGuidelines === true, {
    message: "You must accept the content guidelines to register as a Model",
    path: ["acceptedContentGuidelines"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
