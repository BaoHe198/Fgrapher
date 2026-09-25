import { getTranslations } from "next-intl/server";

import { requestErrorKey } from "@/lib/request-error-messages";

/**
 * The user-facing, translated text for an OfferError / ServiceRequestError.
 * A message with no key is passed through: that is the booking error an
 * accepted offer re-throws, already translated (see acceptOffer). Every
 * English literal thrown in the services has a key — the unit test checks.
 */
export async function requestErrorMessage(err: Error) {
  const key = requestErrorKey(err.message);
  if (!key) return err.message;
  const t = await getTranslations("apiMessages.requestErrors");
  return t(key);
}
