/**
 * Upper bound for any amount of money a person types in (VND). Far above any
 * real photo/video service or piece of gear, low enough to catch a slipped
 * keystroke: a price edit that appended digits instead of replacing them was
 * saved as 4.500.000.044.000.000₫ before this existed.
 */
export const MAX_VND_AMOUNT = 10_000_000_000;

/** Digits a money field accepts while typing — one more than MAX_VND_AMOUNT has. */
export const MAX_VND_DIGITS = 11;
