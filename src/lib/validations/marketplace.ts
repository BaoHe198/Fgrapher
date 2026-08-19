import { z } from "zod";

export const addToCartSchema = z
  .object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(99).default(1),
    type: z.enum(["SALE", "RENT"]),
    rentalStart: z.string().optional(),
    rentalEnd: z.string().optional(),
  })
  .refine((data) => data.type !== "RENT" || (data.rentalStart && data.rentalEnd), {
    message: "Rental dates are required",
    path: ["rentalStart"],
  });

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  deliveryMethod: z.enum(["SHIP", "PICKUP"]),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
  trackingNumber: z.string().max(100).optional(),
  trackingCarrier: z.string().max(100).optional(),
  cancelReason: z.string().max(500).optional(),
});

export const returnRentalSchema = z.object({
  deductDeposit: z.boolean(),
  note: z.string().max(500).optional(),
});
