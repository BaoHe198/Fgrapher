import { z } from "zod";

import { isAtLeast18 } from "@/lib/age-gate";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Translated variant of loginSchema — Zod schemas are built at module scope
// (outside any request), so they can't call the async getTranslations()
// themselves. Route handlers that have a `t` instance (namespace
// "libServices.validation.auth") should call this factory instead of using
// the bare `loginSchema` export above, which keeps its English fallback
// text for any caller not yet wired up to it.
export function getLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("emailInvalid")),
    password: z.string().min(8, t("passwordMinLength")),
  });
}

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
    // Age gate (Prompt B3, docs/guides/fgrapher-danh-gia-va-prompt-sua-doi.md)
    // — required for EVERY account as of B3, not just MODEL (was optional
    // before). Stored privately on User; never returned to the client or
    // displayed, only used to compute a public age range (see
    // lib/age-gate.ts's getAgeRangeLabel).
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    // Content guidelines acceptance (§3b item 3) — required only when
    // MODEL is selected.
    acceptedContentGuidelines: z.boolean().optional(),
    // Personal-data consent (Prompt B2, docs/guides/
    // fgrapher-danh-gia-va-prompt-sua-doi.md) — three SEPARATE choices,
    // never pre-ticked, never gated together. consentService is the only
    // one required to register at all; the other two are genuinely
    // optional and must not block registration either way.
    consentService: z.boolean(),
    consentMarketing: z.boolean(),
    consentAnalytics: z.boolean(),
  })
  .refine((data) => data.accountType !== "provider" || data.roles.length > 0, {
    message: "Select at least one role",
    path: ["roles"],
  })
  .refine((data) => data.consentService === true, {
    message: "You must agree to data processing to create an account",
    path: ["consentService"],
  })
  .refine((data) => isAtLeast18(new Date(data.dateOfBirth)), {
    message: "You must be at least 18 years old to create a Fgrapher account",
    path: ["dateOfBirth"],
  })
  .refine(
    (data) =>
      !data.roles.includes("MODEL") || data.acceptedContentGuidelines === true,
    {
      message: "You must accept the content guidelines to register as a Model",
      path: ["acceptedContentGuidelines"],
    },
  );

export type RegisterInput = z.infer<typeof registerSchema>;

// Translated variant of registerSchema — see getLoginSchema's comment above
// for why this is a factory rather than a bare schema. Namespace
// "libServices.validation.auth".
export function getRegisterSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(2, t("nameRequired")),
      email: z.string().email(t("emailInvalid")),
      password: z
        .string()
        .min(8, t("passwordMinLength"))
        .regex(/[A-Z]/, t("passwordUppercase"))
        .regex(/[0-9]/, t("passwordNumber")),
      accountType: z.enum(["customer", "provider"]),
      roles: z.array(z.enum(PAID_ROLE_VALUES)),
      dateOfBirth: z.string().min(1, t("dateOfBirthRequired")),
      acceptedContentGuidelines: z.boolean().optional(),
      consentService: z.boolean(),
      consentMarketing: z.boolean(),
      consentAnalytics: z.boolean(),
    })
    .refine(
      (data) => data.accountType !== "provider" || data.roles.length > 0,
      {
        message: t("roleRequired"),
        path: ["roles"],
      },
    )
    .refine((data) => data.consentService === true, {
      message: t("consentServiceRequired"),
      path: ["consentService"],
    })
    .refine((data) => isAtLeast18(new Date(data.dateOfBirth)), {
      message: t("mustBe18"),
      path: ["dateOfBirth"],
    })
    .refine(
      (data) =>
        !data.roles.includes("MODEL") ||
        data.acceptedContentGuidelines === true,
      {
        message: t("contentGuidelinesRequired"),
        path: ["acceptedContentGuidelines"],
      },
    );
}
