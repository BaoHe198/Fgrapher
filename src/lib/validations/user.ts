import { Role } from "@prisma/client";
import { z } from "zod";

export const updateRolesSchema = z.object({
  roles: z.array(z.enum(Role)).min(1, "Select at least one role"),
});

export type UpdateRolesInput = z.infer<typeof updateRolesSchema>;
