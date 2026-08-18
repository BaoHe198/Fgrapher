import { Role } from "@prisma/client";
import { z } from "zod";

export const updateRolesSchema = z.object({
  roles: z.array(z.enum(Role)).min(1, "Select at least one role"),
});

export type UpdateRolesInput = z.infer<typeof updateRolesSchema>;

export const updateMeSchema = z.object({
  acceptingBookings: z.boolean().optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
