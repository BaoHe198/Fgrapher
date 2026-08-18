import { z } from "zod";

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
  })
  .refine((data) => data.accountType !== "provider" || data.roles.length > 0, {
    message: "Select at least one role",
    path: ["roles"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
