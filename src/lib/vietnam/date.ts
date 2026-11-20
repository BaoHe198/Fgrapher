const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

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

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Midnight on the 1st of a month in Vietnam, as an instant — the current
 * month, or `monthsBack` months before it. Building it from the server's
 * clock (UTC on Vercel) starts the month seven hours late, so whatever
 * happened before 07:00 on the 1st Vietnam time lands in the month before.
 */
export function vietnamMonthStart(now = new Date(), monthsBack = 0) {
  const vn = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  return new Date(
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - monthsBack, 1) -
      VIETNAM_OFFSET_MS,
  );
}
