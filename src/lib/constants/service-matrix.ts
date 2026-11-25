import type { Role } from "@prisma/client";

/**
 * What a provider can be hired FOR, as opposed to what they are called.
 *
 * `Role` answers "who is this provider?"; ServiceKind answers "what can a
 * customer hire them to do?". The two are not the same question, which is
 * why a studio with a shooting crew could not be described before: it is a
 * STUDIO that offers PHOTOGRAPHY, not a new role.
 *
 * Kept as an enum rather than a lookup table (project owner, 22/09/2026):
 * the set changes slowly, and every new value needs UI, labels, SEO and KYC
 * rules anyway, so a row an admin can insert would not actually save work.
 */
export const SERVICE_KINDS = [
  "PHOTOGRAPHY",
  "VIDEOGRAPHY",
  "VENUE_RENTAL",
  "MAKEUP",
  "MODELING",
] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

/**
 * Which services each role may offer. The single source of truth: validate
 * against this in the service layer, never re-list these sets in a component.
 *
 * Settled by the project owner on 22/09/2026 for the CURRENT set of roles:
 * - A photographer and a videographer may offer each other's craft, because
 *   most of them do both.
 * - VENUE_RENTAL is a studio's own service and nobody else's.
 * - A studio may also offer PHOTOGRAPHY, VIDEOGRAPHY and MAKEUP — that is
 *   exactly the "studio with a crew" case.
 * - A make-up artist may NOT offer MODELING (owner's explicit call).
 * - Neither shop role offers services at all: a camera shop sells on Chợ F,
 *   and a costume shop is a catalogue plus messaging.
 */
export const SERVICE_KINDS_BY_ROLE: Partial<Record<Role, ServiceKind[]>> = {
  PHOTOGRAPHER: ["PHOTOGRAPHY", "VIDEOGRAPHY"],
  VIDEOGRAPHER: ["VIDEOGRAPHY", "PHOTOGRAPHY"],
  MAKEUP_ARTIST: ["MAKEUP"],
  MODEL: ["MODELING"],
  STUDIO: ["VENUE_RENTAL", "PHOTOGRAPHY", "VIDEOGRAPHY", "MAKEUP"],
};

/** Whether this role is allowed to offer this service. */
export function serviceKindAllowedForRole(role: Role, kind: string) {
  return (SERVICE_KINDS_BY_ROLE[role] ?? []).includes(kind as ServiceKind);
}

/** The services this role may offer, empty for roles that offer none. */
export function serviceKindsForRole(role: Role): ServiceKind[] {
  return SERVICE_KINDS_BY_ROLE[role] ?? [];
}

/**
 * How much of the provider's calendar one booking of a package holds.
 *
 * Three fixed lengths instead of a minutes box (project owner, 25/11/2026,
 * replacing the 21/09/2026 call that hid duration altogether): with no
 * choice at all every package held one hour, so a half-day shoot taken at
 * 08:00 left 09:00 open for someone else. The value stored is still
 * `Service.duration` in minutes; nothing else about a booking changes.
 */
export const SERVICE_HOLD_MINUTES = {
  HOUR: 60,
  HALF_DAY: 240,
  FULL_DAY: 480,
} as const;

export type ServiceHold = keyof typeof SERVICE_HOLD_MINUTES;

export const SERVICE_HOLDS = Object.keys(SERVICE_HOLD_MINUTES) as ServiceHold[];

/**
 * The hold a stored duration falls under. Older packages carry other values
 * (a 90 or 120 minute shoot from before the three levels), so this rounds up
 * to the level that still covers them rather than cutting the hold short.
 */
export function serviceHoldFor(minutes: number): ServiceHold {
  if (minutes <= SERVICE_HOLD_MINUTES.HOUR) return "HOUR";
  if (minutes <= SERVICE_HOLD_MINUTES.HALF_DAY) return "HALF_DAY";
  return "FULL_DAY";
}
