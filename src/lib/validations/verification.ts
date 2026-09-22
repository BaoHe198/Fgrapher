import { z } from "zod";

// Kept in sync with PAID_ROLES in @/lib/constants — hardcoded here (rather
// than derived) since zod needs a literal tuple for z.enum, matching
// validations/auth.ts's own PAID_ROLE_VALUES.
const PAID_ROLE_VALUES = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "CAMERA_SHOP",
  "COSTUME_SHOP",
  "MODEL",
] as const;

/**
 * Which legal form the provider trades as, because it decides what they owe
 * (Luật TMĐT 122/2025). A freelance individual owes nothing beyond the ID
 * card this form already collects — which is why INDIVIDUAL asks for no
 * extra document — while a household business or a company must upload its
 * registration certificate (project owner, 22/09/2026).
 */
const LEGAL_ENTITY_VALUES = [
  "INDIVIDUAL",
  "HOUSEHOLD_BUSINESS",
  "COMPANY",
] as const;

export const submitVerificationSchema = z
  .object({
    role: z.enum(PAID_ROLE_VALUES),
    legalEntityType: z.enum(LEGAL_ENTITY_VALUES),
    businessDocUrl: z.string().url().optional(),
    businessDocPublicId: z.string().min(1).optional(),
    fullName: z.string().min(2, "Enter your full legal name"),
    // Vietnamese CCCD (12 digits, current format) or CMND (9 digits, older
    // format still in circulation) — only ever hashed, never persisted (see
    // services/verification.ts).
    idNumber: z
      .string()
      .regex(/^\d{9}$|^\d{12}$/, "Enter a valid 9 or 12-digit ID number"),
    idFrontUrl: z.string().url(),
    idFrontPublicId: z.string().min(1),
    idBackUrl: z.string().url(),
    idBackPublicId: z.string().min(1),
    selfieUrl: z.string().url(),
    selfiePublicId: z.string().min(1),
    consentIdentityVerification: z.boolean().refine((v) => v === true, {
      message:
        "You must agree to identity document processing to submit verification",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.legalEntityType === "INDIVIDUAL") return;
    if (!data.businessDocUrl || !data.businessDocPublicId) {
      ctx.addIssue({
        code: "custom",
        path: ["businessDocUrl"],
        message:
          "A household business or company must upload its registration certificate",
      });
    }
  });

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

// Translated variant — see validations/auth.ts's getLoginSchema comment.
// Namespace "libServices.validation.verification".
export function getSubmitVerificationSchema(t: (key: string) => string) {
  return z.object({
    role: z.enum(PAID_ROLE_VALUES),
    fullName: z.string().min(2, t("fullNameRequired")),
    idNumber: z.string().regex(/^\d{9}$|^\d{12}$/, t("idNumberInvalid")),
    idFrontUrl: z.string().url(),
    idFrontPublicId: z.string().min(1),
    idBackUrl: z.string().url(),
    idBackPublicId: z.string().min(1),
    selfieUrl: z.string().url(),
    selfiePublicId: z.string().min(1),
    consentIdentityVerification: z.boolean().refine((v) => v === true, {
      message: t("consentRequired"),
    }),
  });
}
