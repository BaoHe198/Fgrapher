/**
 * F Booking's OfferError / ServiceRequestError messages are English (for
 * logs) and used to reach the screens verbatim — e.g. an unverified provider
 * sending an offer read "You must be a verified provider to send offers".
 * Each maps to a key under apiMessages.requestErrors; the unit test fails if
 * a thrown message has no entry. Matched by prefix where the message embeds
 * a number.
 */
export const REQUEST_ERROR_KEYS: Record<string, string> = {
  "Offer not found": "offerNotFound",
  "You cannot send an offer to your own request": "ownRequest",
  "Service request not found": "requestNotFound",
  "You don't own this request": "notOwner",
  "Verify your phone number before posting a request": "phoneRequired",
  "This request has already been posted": "alreadyPosted",
  "You've already sent an offer for this request": "alreadyOffered",
  "You must be a verified provider to send offers": "mustBeVerified",
  "This request is no longer accepting offers": "noLongerAccepting",
  "This request can't be cancelled": "cannotCancel",
  "This offer is no longer available — it may have just been withdrawn or expired":
    "offerGone",
  "Only a pending offer can be withdrawn": "onlyPendingWithdraw",
  "Only a pending offer can be edited": "onlyPendingEdit",
  "Only a pending offer can be declined": "onlyPendingDecline",
  "Date range start can't be after the end": "dateRangeBackwards",
  "Budget minimum can't be greater than the maximum": "budgetBackwards",
  "You already have ": "tooManyOpen",
};

export function requestErrorKey(message: string): string | null {
  if (REQUEST_ERROR_KEYS[message]) return REQUEST_ERROR_KEYS[message];
  const prefix = Object.keys(REQUEST_ERROR_KEYS).find(
    (known) => known.endsWith(" ") && message.startsWith(known),
  );
  return prefix ? REQUEST_ERROR_KEYS[prefix] : null;
}
