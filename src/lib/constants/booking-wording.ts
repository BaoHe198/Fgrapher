// Which words a booking screen uses for the provider's kind of work.
//
// The booking flow was written for photographers: "buổi chụp", "ngày chụp",
// golden-hour hints. A make-up artist and a studio read the same sentences
// about their own appointments (role walk-through, 25/11/2026). The message
// catalogs pick a variant from this value with an ICU `select`; "photo" is
// the `other` branch, so an unknown role reads as it always did.
export type BookingWording = "photo" | "film" | "makeup" | "studio" | "model";

const WORDING_BY_ROLE: Record<string, BookingWording> = {
  PHOTOGRAPHER: "photo",
  VIDEOGRAPHER: "film",
  MAKEUP_ARTIST: "makeup",
  STUDIO: "studio",
  MODEL: "model",
};

export function bookingWordingFor(
  role: string | null | undefined,
): BookingWording {
  return (role && WORDING_BY_ROLE[role]) || "photo";
}

// Sunrise and golden hour only help work that depends on daylight. A make-up
// appointment or a studio room does not, so those roles get no sun hints.
const DAYLIGHT_ROLES = new Set(["PHOTOGRAPHER", "VIDEOGRAPHER", "MODEL"]);

export function usesDaylight(role: string | null | undefined): boolean {
  return !!role && DAYLIGHT_ROLES.has(role);
}
