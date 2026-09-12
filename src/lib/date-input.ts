// dd/MM/yyyy text <-> yyyy-MM-dd value, for <DateField>.
//
// Why this exists: a native <input type="date"> renders its text in the
// format of the *browser's UI language*, not the page's. A Vietnamese site
// opened in an English-language Chrome shows "09/13/2026" — and since the
// separator and the digit count are identical to "13/09/2026", nothing on
// screen tells the user which one they are looking at. Setting `lang="vi"`
// on the page does not change it; neither does navigator.language. The only
// way to guarantee CLAUDE.md rule 10's dd/MM/yyyy is to render the text
// ourselves, which is what DateField does.
//
// Everything here is string arithmetic on purpose. These are plain calendar
// dates ("2026-09-13"), not instants, and routing them through `new Date()`
// would drag Asia/Ho_Chi_Minh vs UTC into a place that has no business
// caring: `new Date("2026-09-13")` is midnight UTC, which is still the 12th
// in half the world, and formatting it back can move the day.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number) {
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

/** "2026-09-13" -> "13/09/2026". Anything else -> "". */
export function isoToDisplay(iso: string | undefined | null) {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** "13/09/2026" -> "2026-09-13". Returns null unless it's a real date. */
export function displayToIso(display: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  // 31/02 and 00/00 parse fine as numbers; they are not dates.
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  // A four-digit year is already enforced by the pattern; this rules out
  // year 0000 from a mistyped entry.
  if (year < 1) return null;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * Formats what the user is typing, one keystroke at a time: digits only,
 * slashes inserted automatically, never more than 8 digits. Typing "13092026"
 * produces "13/09/2026" without the user ever pressing "/".
 *
 * Deleting has to work too — "13/09/" backspaced to "13/09" must not have its
 * slash re-added, or the caret fights the user and the field can't be
 * cleared. Hence `isDeleting`: on delete we format what's left but never pad
 * a trailing separator back on.
 */
export function maskDateInput(raw: string, isDeleting = false) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";

  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  const filled = parts.filter((part) => part.length > 0);
  const text = filled.join("/");

  // Mid-field, add the separator as soon as a part is complete so the next
  // digit lands in the next part. Not while deleting — see above.
  if (!isDeleting && (digits.length === 2 || digits.length === 4)) {
    return `${text}/`;
  }
  return text;
}

/**
 * Decides what a keystroke commits. `null` means "nothing yet" — the user is
 * mid-date, and the field keeps whatever value it already had rather than
 * flickering through 01/01/0002 as the year is typed.
 *
 * Note that an out-of-range date still commits. min/max steer the calendar
 * picker, exactly as they do on a native date input, where typing a date
 * outside them is also allowed — the call sites that care (the request
 * wizard's start/end pair, for one) show their own error, which they can't do
 * for a value they never receive.
 */
export function commitFromDisplay(display: string): string | null {
  if (display.trim() === "") return "";
  return displayToIso(display);
}
