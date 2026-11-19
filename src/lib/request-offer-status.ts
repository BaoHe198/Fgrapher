import type { RequestOfferStatus, ServiceRequestStatus } from "@prisma/client";

/**
 * How an offer's state should read on screen.
 *
 * When a request is cancelled or expires, every offer still waiting on it is
 * stored as DECLINED: there is no "closed" offer state. Shown as it is
 * stored, that told a provider "Đã bị từ chối" about an offer nobody turned
 * down, and told the customer they had declined offers they never answered.
 * The request's own state is the truer thing to show.
 *
 * An offer the customer really did decline before cancelling reads the same
 * way afterwards; the request being gone is still what matters to both sides.
 */
export type OfferDisplayStatus =
  RequestOfferStatus | "REQUEST_CANCELLED" | "REQUEST_EXPIRED";

export function offerDisplayStatus(
  offerStatus: RequestOfferStatus,
  requestStatus: ServiceRequestStatus,
): OfferDisplayStatus {
  if (offerStatus !== "DECLINED") return offerStatus;
  if (requestStatus === "CANCELLED") return "REQUEST_CANCELLED";
  if (requestStatus === "EXPIRED") return "REQUEST_EXPIRED";
  return offerStatus;
}
