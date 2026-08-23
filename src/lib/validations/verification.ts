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
  "MODEL",
] as const;

export const submitVerificationSchema = z.object({
  role: z.enum(PAID_ROLE_VALUES),
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
});

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
