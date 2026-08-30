import { z } from "zod";

export const sendPhoneCodeSchema = z.object({
  phone: z.string().min(1),
});

export const verifyPhoneCodeSchema = z.object({
  phone: z.string().min(1),
  code: z.string().min(4).max(10),
});
