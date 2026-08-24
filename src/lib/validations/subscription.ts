import { z } from "zod";

export const checkoutSchema = z.object({
  roles: z
    .array(
      z.enum([
        "PHOTOGRAPHER",
        "VIDEOGRAPHER",
        "MAKEUP_ARTIST",
        "STUDIO",
        "CAMERA_SHOP",
        "MODEL",
      ]),
    )
    .min(1, "Select at least one role"),
  interval: z.enum(["month", "year"]).default("month"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// Translated variant — see validations/auth.ts's getLoginSchema comment.
// Namespace "libServices.validation.subscription". Stripe checkout is
// disabled (BILLING_ENABLED=false per CLAUDE.md), but kept translated for
// when billing is re-enabled.
export function getCheckoutSchema(t: (key: string) => string) {
  return z.object({
    roles: z
      .array(
        z.enum([
          "PHOTOGRAPHER",
          "VIDEOGRAPHER",
          "MAKEUP_ARTIST",
          "STUDIO",
          "CAMERA_SHOP",
          "MODEL",
        ]),
      )
      .min(1, t("roleRequired")),
    interval: z.enum(["month", "year"]).default("month"),
  });
}
