// Sunrise and sunset for a place and a day, for the booking flow's golden
// hour hints (redesign 09/2026, audit §06). NOAA's simplified solar
// position equations - accurate to about a minute between the polar
// circles, far finer than a 30- or 60-minute time slot needs. Pure maths:
// no API, no dependency, runs on the client from the shoot's coordinates.
//
// Times come back as minutes after local midnight in Vietnam (UTC+7, no
// daylight saving), which is the clock every slot in the app is written in.

const VIETNAM_UTC_OFFSET_MIN = 7 * 60;
const RAD = Math.PI / 180;

export interface SunTimes {
  /** Minutes after local midnight, e.g. 345 = 05:45. */
  sunrise: number;
  sunset: number;
}

/** `dateKey` is "yyyy-MM-dd" in Vietnam time. */
export function sunTimes(
  dateKey: string,
  latitude: number,
  longitude: number,
): SunTimes | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;

  const dayOfYear = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000;
  // Fractional year (radians) at local noon.
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  // 90.833°: the sun's disc touching the horizon, refraction included.
  const cosHa =
    Math.cos(90.833 * RAD) / (Math.cos(latitude * RAD) * Math.cos(decl)) -
    Math.tan(latitude * RAD) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null; // polar day or night

  const ha = Math.acos(cosHa) / RAD;
  const solarNoonUtc = 720 - 4 * longitude - eqTime;
  const sunriseUtc = solarNoonUtc - 4 * ha;
  const sunsetUtc = solarNoonUtc + 4 * ha;

  return {
    sunrise: Math.round(sunriseUtc + VIETNAM_UTC_OFFSET_MIN),
    sunset: Math.round(sunsetUtc + VIETNAM_UTC_OFFSET_MIN),
  };
}

/** "HH:mm" → minutes after midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Minutes after midnight → "HH:mm". */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Whether a slot starting at `start` catches golden light (wave 2 booking
 * design): about forty minutes around sunrise, and from an hour and a half
 * to twenty minutes before sunset - low, soft, warm light. A slot that
 * starts in the window is enough; shoots run past their start time.
 */
export function isGoldenHourSlot(start: string, sun: SunTimes): boolean {
  const t = timeToMinutes(start);
  return (
    (t >= sun.sunrise - 20 && t <= sun.sunrise + 20) ||
    (t >= sun.sunset - 90 && t <= sun.sunset - 20)
  );
}
