import { Role } from "@prisma/client";
import { z } from "zod";

export const updateRolesSchema = z.object({
  roles: z.array(z.enum(Role)).min(1, "Select at least one role"),
});

export type UpdateRolesInput = z.infer<typeof updateRolesSchema>;

const notificationChannelsSchema = z.object({ email: z.boolean(), inApp: z.boolean() });

export const NOTIFICATION_KEYS = [
  "bookingRequest",
  "bookingConfirmed",
  "bookingCancelled",
  "bookingReminder",
  "newMessage",
  "newFollower",
  "newReview",
  "productUpdates",
  "tips",
] as const;

export const notificationPreferencesSchema = z.object(
  Object.fromEntries(NOTIFICATION_KEYS.map((key) => [key, notificationChannelsSchema])) as Record<
    (typeof NOTIFICATION_KEYS)[number],
    typeof notificationChannelsSchema
  >,
);

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateMeSchema = z.object({
  acceptingBookings: z.boolean().optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  avatar: z.string().url().nullable().optional(),
  coverImage: z.string().url().nullable().optional(),
  bio: z.string().max(500, "Bio must be 500 characters or fewer").optional(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only")
    .optional(),
  name: z.string().min(2).optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(120).optional(),
  email: z.string().email().optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
