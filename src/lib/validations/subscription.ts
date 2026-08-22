import { z } from "zod";

export const checkoutSchema = z.object({
  roles: z
    .array(z.enum(["PHOTOGRAPHER", "VIDEOGRAPHER", "MAKEUP_ARTIST", "STUDIO", "CAMERA_SHOP", "MODEL"]))
    .min(1, "Select at least one role"),
  interval: z.enum(["month", "year"]).default("month"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
