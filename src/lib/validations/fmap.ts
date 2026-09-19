import { ProfileCategory } from "@prisma/client";
import { z } from "zod";

export const FMAP_PROVIDER_ROLES = [
  "PHOTOGRAPHER",
  "VIDEOGRAPHER",
  "MAKEUP_ARTIST",
  "STUDIO",
  "MODEL",
] as const;

const coordinate = z.coerce.number().finite();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");

export const fmapSearchSchema = z
  .object({
    north: coordinate.min(-90).max(90),
    south: coordinate.min(-90).max(90),
    east: coordinate.min(-180).max(180),
    west: coordinate.min(-180).max(180),
    date: calendarDate,
    start: time,
    end: time,
    roles: z
      .array(z.enum(FMAP_PROVIDER_ROLES))
      .min(1)
      .max(FMAP_PROVIDER_ROLES.length),
    categories: z.array(z.enum(ProfileCategory)).max(20).default([]),
  })
  .superRefine((value, context) => {
    if (value.north <= value.south) {
      context.addIssue({
        code: "custom",
        path: ["north"],
        message: "north must be above south",
      });
    }
    if (value.east <= value.west) {
      context.addIssue({
        code: "custom",
        path: ["east"],
        message: "east must be east of west",
      });
    }
    if (value.north - value.south > 6 || value.east - value.west > 6) {
      context.addIssue({
        code: "custom",
        path: ["north"],
        message: "Map area is too large; zoom in before searching",
      });
    }

    const [startHour, startMinute] = value.start.split(":").map(Number);
    const [endHour, endMinute] = value.end.split(":").map(Number);
    const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    if (duration <= 0) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "end must be after start",
      });
    } else if (duration > 12 * 60) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "Time range cannot exceed 12 hours",
      });
    }
  });

export type FmapSearchInput = z.infer<typeof fmapSearchSchema>;

export function parseCommaSeparated(value: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
