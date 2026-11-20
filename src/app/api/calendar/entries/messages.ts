/**
 * calendarEntrySchema reports problems as keys (see validations/calendar.ts);
 * this turns the first one into the sentence the form shows. Anything the
 * schema did not name is the generic "check the form" line.
 */
const ENTRY_ISSUE_KEYS = new Set([
  "titleRequired",
  "titleTooLong",
  "endBeforeStart",
  "phoneInvalid",
]);

export function entryIssueMessage(
  t: (key: string) => string,
  issue: string | undefined,
) {
  return issue && ENTRY_ISSUE_KEYS.has(issue)
    ? t(`entryErrors.${issue}`)
    : t("invalidEntry");
}
