import { z } from "zod";

import { isDateKey } from "@/lib/calendar/agenda";
import { MAX_VND_AMOUNT } from "@/lib/validations/money";

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dateKey = z.string().refine(isDateKey);

/** "" and whitespace are "not filled in", not a value to store. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullish();

// Messages are keys under dashboardCore.calendar.entryErrors — the route
// translates them (see /api/calendar/entries).
export const calendarEntrySchema = z
  .object({
    title: z.string().trim().min(1, "titleRequired").max(120, "titleTooLong"),
    date: dateKey,
    startTime: timeString,
    endTime: timeString,
    locationAddress: optionalText(300),
    customerName: optionalText(120),
    // Digits with the usual separators; not validated as a Vietnamese mobile
    // number, because a studio's landline or a client abroad is as valid.
    customerPhone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+\d][\d\s().-]*$/, "phoneInvalid")
      .or(z.literal(""))
      .transform((value) => (value === "" ? null : value))
      .nullish(),
    price: z.coerce
      .number()
      .positive()
      .max(MAX_VND_AMOUNT)
      .nullish()
      .or(z.literal("").transform(() => null)),
    notes: optionalText(2000),
  })
  // One calendar day at a time: a job that runs past midnight is entered as
  // ending at 23:59, which is how a provider reads their own day anyway.
  .refine((entry) => entry.endTime > entry.startTime, {
    message: "endBeforeStart",
    path: ["endTime"],
  });

export type CalendarEntryInput = z.infer<typeof calendarEntrySchema>;

export const bookingNoteSchema = z.object({
  note: z.string().trim().max(2000),
});

export const calendarRangeSchema = z
  .object({ from: dateKey, to: dateKey })
  .refine((range) => range.from < range.to)
  // Six weeks is a month grid; anything far beyond is not the calendar page.
  .refine(
    (range) =>
      new Date(`${range.to}T00:00:00.000Z`).getTime() -
        new Date(`${range.from}T00:00:00.000Z`).getTime() <=
      93 * 86_400_000,
  );
