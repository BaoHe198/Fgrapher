import { z } from "zod";

import { isCloudinaryDeliveryUrl } from "@/lib/media-kind";

/**
 * The single limit on reference photos/videos attached to a job.
 *
 * One number, shared by the service-request schema AND the booking schema,
 * because a request's references become that booking's references when the
 * customer accepts an offer (acceptOffer -> createBooking). With two limits
 * — as briefly existed, 10 for a request and 5 for a booking — a request
 * holding 6-10 references produced booking input that contradicted the
 * booking schema. It only went unrejected because acceptOffer never ran
 * that schema; the moment createBooking validated its own input (an obvious
 * hardening to make), accepting any such offer would have failed outright.
 * A shared constant makes "a request's references always fit its booking"
 * true by construction instead of by luck.
 *
 * 10, not 5: it was already the request limit, so no existing request is
 * invalidated or truncated; and it adds no storage exposure a request didn't
 * already allow. The booking's old 5 was never a user-facing policy — that
 * field had no UI at all until reference media shipped.
 */
export const MAX_REFERENCE_MEDIA = 10;

// Only Cloudinary delivery URLs. Every real upload path goes browser ->
// Cloudinary and stores the secure_url it returns; anything else was typed
// into an API call by hand, and would be rendered straight into another
// user's browser (the provider reading the booking or request).
export const referenceMediaUrlSchema = z
  .string()
  .url()
  .refine(isCloudinaryDeliveryUrl, "Reference media must be an uploaded file");

/**
 * What a service request's references become on the booking created when an
 * offer is accepted. Extracted so the regression test exercises the exact
 * mapping acceptOffer uses, not a copy of it.
 */
export function referenceUrlsForBooking(
  references: readonly { mediaUrl: string }[],
): string[] {
  return references.map((ref) => ref.mediaUrl);
}
