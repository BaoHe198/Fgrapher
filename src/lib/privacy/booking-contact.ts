/**
 * Whether the provider on a booking may see the customer's contact details:
 * the phone number, the street address, and the photo spot chosen for the
 * shoot.
 *
 * The rule the product states (Prompt B7, VIỆC 4): a provider sees them once
 * they have accepted the request. The code used to ask only "is it no
 * longer PENDING?", which is not the same thing: a request the provider
 * DECLINED, one that EXPIRED unanswered, and one the customer withdrew all
 * stop being PENDING without anyone accepting, and each of them then showed
 * the customer's phone and address to a provider who had turned the job
 * down or never replied (found 26/11/2026).
 *
 * So: yes for a booking that is confirmed, or went on from confirmed
 * (completed, no-show). For a cancelled one, only if it had been confirmed
 * first, which the caller must know from the status history; a list that
 * does not load the history passes nothing and gets "no". Never for
 * pending, declined or expired.
 *
 * The customer always sees their own details back; this is only about the
 * provider.
 */
export function providerMaySeeContact(
  status: string,
  wasConfirmed?: boolean,
): boolean {
  if (
    status === "CONFIRMED" ||
    status === "COMPLETED" ||
    status === "NO_SHOW"
  ) {
    return true;
  }
  if (status === "CANCELLED") return wasConfirmed === true;
  return false;
}
