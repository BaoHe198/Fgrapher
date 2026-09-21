import { z } from "zod";

export const addToCartSchema = z
  .object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(99).default(1),
    type: z.enum(["SALE", "RENT"]),
    rentalStart: z.string().optional(),
    rentalEnd: z.string().optional(),
  })
  .refine(
    (data) => data.type !== "RENT" || (data.rentalStart && data.rentalEnd),
    {
      message: "Rental dates are required",
      path: ["rentalStart"],
    },
  );

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  deliveryMethod: z.enum(["SHIP", "PICKUP"]),
  // Required for SHIP; the service rejects an empty one. Collected here
  // because payment (and therefore Stripe's address step) is gone — the
  // shop delivers and collects the money itself.
  shippingAddress: z.string().trim().max(300).optional(),
});

export const updateOrderStatusSchema = z.object({
  // PICKED_UP is the rental leg where the customer collects at the shop.
  // OVERDUE and RETURNED are deliberately absent: OVERDUE is only ever set by
  // the cron, RETURNED only through POST /api/orders/[id]/return, which also
  // settles the deposit.
  status: z.enum([
    "CONFIRMED",
    "SHIPPED",
    "DELIVERED",
    "PICKED_UP",
    "CANCELLED",
  ]),
  trackingNumber: z.string().max(100).optional(),
  trackingCarrier: z.string().max(100).optional(),
  cancelReason: z.string().max(500).optional(),
});

export const returnRentalSchema = z.object({
  deductDeposit: z.boolean(),
  note: z.string().max(500).optional(),
  // Recorded only — the shop settles these with the customer directly.
  lateFeeAmount: z.number().nonnegative().max(1_000_000_000).optional(),
  damageFeeAmount: z.number().nonnegative().max(1_000_000_000).optional(),
});

// Translated variant — see validations/auth.ts's getLoginSchema comment.
// Namespace "libServices.validation.marketplace". Marketplace/shop is
// currently hidden behind the CAMERA_SHOP feature flag (out of MVP scope
// per CLAUDE.md), but kept translated for when it's re-enabled.
export function getAddToCartSchema(t: (key: string) => string) {
  return z
    .object({
      productId: z.string().min(1),
      quantity: z.coerce.number().int().min(1).max(99).default(1),
      type: z.enum(["SALE", "RENT"]),
      rentalStart: z.string().optional(),
      rentalEnd: z.string().optional(),
    })
    .refine(
      (data) => data.type !== "RENT" || (data.rentalStart && data.rentalEnd),
      {
        message: t("rentalDatesRequired"),
        path: ["rentalStart"],
      },
    );
}
