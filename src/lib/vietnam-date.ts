export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Returns the current Vietnam calendar date as YYYY-MM-DD. */
export function vietnamDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * BlockedDate is stored as a date-only value at UTC midnight. Convert the
 * current Vietnam day to that same representation before querying it.
 */
export function vietnamDateStart(now = new Date()) {
  return new Date(`${vietnamDateKey(now)}T00:00:00.000Z`);
}
