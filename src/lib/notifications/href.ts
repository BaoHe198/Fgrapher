import type { NotificationType } from "@prisma/client";

interface NotificationLike {
  type: NotificationType;
  data: unknown;
}

// F Booking notifications carry only the request id; which page it opens
// depends on who received it. These go to the customer who posted it…
const CUSTOMER_REQUEST_TYPES = new Set<NotificationType>([
  "REQUEST_NEW_OFFER",
  "REQUEST_NO_OFFERS_48H",
]);
// …and these to a provider, about a request they could answer or did.
const PROVIDER_REQUEST_TYPES = new Set<NotificationType>([
  "REQUEST_NEW_MATCH",
  "REQUEST_OFFER_DECLINED",
]);

/**
 * Where a notification opens. Shared by the bell and the notifications page,
 * which used to keep a copy each and drifted apart (the page never learned
 * the post link). Request notifications used to fall through to the list.
 */
export function notificationHref(notification: NotificationLike): string {
  const data = notification.data as {
    bookingId?: string;
    orderId?: string;
    postId?: string;
    requestId?: string;
    href?: string;
  } | null;
  if (data?.href?.startsWith("/dashboard/")) return data.href;
  if (data?.bookingId) return `/dashboard/bookings/${data.bookingId}`;
  if (data?.orderId) return `/dashboard/orders/${data.orderId}`;
  // A like or a comment is only useful if it takes you to the post it is
  // about.
  if (data?.postId) return `/community/${data.postId}`;
  if (data?.requestId) {
    if (CUSTOMER_REQUEST_TYPES.has(notification.type)) {
      return `/dashboard/requests/${data.requestId}`;
    }
    if (PROVIDER_REQUEST_TYPES.has(notification.type)) {
      return `/dashboard/opportunities/${data.requestId}`;
    }
  }
  return "/dashboard/notifications";
}
