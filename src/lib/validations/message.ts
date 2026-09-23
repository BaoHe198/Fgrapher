import { z } from "zod";

export const startConversationSchema = z.object({
  userId: z.string().min(1),
});

export const sendMessageSchema = z
  .object({
    conversationId: z.string().min(1),
    content: z.string().min(1).max(2000),
    type: z.enum(["text", "image", "booking_link"]).default("text"),
    mediaUrl: z.string().url().optional(),
    mediaPublicId: z.string().min(1).optional(),
    bookingId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "image" && (!data.mediaUrl || !data.mediaPublicId)) {
      ctx.addIssue({
        code: "custom",
        message: "Image messages require verified upload metadata",
        path: ["mediaUrl"],
      });
    }
  });

export const blockUserSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().max(300).optional(),
});
