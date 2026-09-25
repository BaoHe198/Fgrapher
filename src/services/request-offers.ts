import type {
  Prisma,
  RequestOfferStatus,
  Role,
  ServiceRequest,
} from "@prisma/client";

import { getTranslations } from "next-intl/server";

import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { wholeDayBlockedProviders } from "@/services/resource-calendar";
import {
  requestNewOfferEmailHtml,
  requestOfferAcceptedEmailHtml,
  requestOfferDeclinedEmailHtml,
} from "@/lib/email";
import type { BatchRecipient } from "@/lib/notifications";
import type { NotificationPreferences } from "@/lib/validations/user";
import { referenceMediaForBooking } from "@/lib/validations/reference-media";
import { logAudit } from "@/services/compliance";
import {
  SERVICE_AREA_SELECT,
  profileProvinceIds,
  providerCoversProvince,
} from "@/services/service-areas";
import {
  BookingActionError,
  bookingErrorMessage,
  createBooking,
} from "@/services/bookings";
import {
  NotificationBatchError,
  notify,
  notifyInAppBatch,
} from "@/services/notification";

function requestUrlFor(requestId: string) {
  return appUrl(`/dashboard/requests/${requestId}`);
}

// The same request seen from the provider's side. /dashboard/requests/<id>
// is the customer's page, and a provider following it got "not found".
function opportunityUrlFor(requestId: string) {
  return appUrl(`/dashboard/opportunities/${requestId}`);
}

// namespace "libServices.email" — every caller below runs in a request
// context (route handlers), so the request locale is used.
function getRequestEmailT() {
  return getTranslations("libServices.email");
}

// In-app notification copy — namespace "libServices.notifications". Offer
// events use the request's locale. notifyMatchingProviders passes
// { locale: "vi" } explicitly: its recipients are providers, not the person
// whose request is being handled, so that request's locale must not decide
// the language every matched provider reads.
function getRequestNotifyT(locale?: "vi") {
  return locale
    ? getTranslations({ locale, namespace: "libServices.notifications" })
    : getTranslations("libServices.notifications");
}

export class OfferError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "OfferError";
  }
}

export class OfferNotFoundError extends OfferError {
  constructor() {
    super("Offer not found", 404);
  }
}

export class OwnRequestOfferError extends OfferError {
  constructor() {
    super("You cannot send an offer to your own request", 403);
    this.name = "OwnRequestOfferError";
  }
}

/**
 * Central server-side policy for creating an offer. Kept independent from
 * the database call so every direct/API caller gets the same ownership and
 * request-state checks, and the business rule can be tested without a live DB.
 */
type OfferableRequest = Pick<
  ServiceRequest,
  "customerId" | "isDraft" | "role" | "status"
>;

type ViewableOpportunity = OfferableRequest & {
  offers: readonly { id: string }[];
};

/**
 * The detail endpoint carries more information than the public request cards,
 * including reference media. Moderation states must stay private. A provider
 * may still revisit a closed request from their offer history, but only when
 * the provider-filtered query proves they actually submitted an offer.
 */
export function assertProviderMayViewOpportunity(
  request: ViewableOpportunity | null,
  providerId: string,
  role: Role,
): asserts request is ViewableOpportunity {
  if (
    !request ||
    request.isDraft ||
    request.role !== role ||
    request.customerId === providerId
  ) {
    throw new OfferNotFoundError();
  }

  const isOpen = request.status === "OPEN" || request.status === "HAS_OFFERS";
  if (!isOpen && request.offers.length === 0) {
    throw new OfferNotFoundError();
  }
}

export function assertProviderMayOffer(
  request: OfferableRequest | null,
  providerId: string,
  role: Role,
): asserts request is OfferableRequest {
  if (!request || request.isDraft || request.role !== role) {
    throw new OfferNotFoundError();
  }
  if (request.customerId === providerId) {
    throw new OwnRequestOfferError();
  }
  if (request.status !== "OPEN" && request.status !== "HAS_OFFERS") {
    throw new OfferError("This request is no longer accepting offers", 400);
  }
}

// Lọc cứng (thiết kế đã duyệt, mục 03) — mọi điều kiện đều phải đạt để một
// provider được coi là ứng viên, dùng chung cho cả feed "Yêu cầu phù hợp"
// lẫn danh sách nhận thông báo chủ động khi có yêu cầu mới. KHÔNG lọc theo
// gói trả phí đang active — quyết định của chủ dự án, mở cho provider trải
// nghiệm ở giai đoạn MVP (chỉ role + xác minh danh tính là bắt buộc, vì lý
// do pháp lý/an toàn không thể bỏ).
//
// Returns each candidate's notification preferences with them, read in the
// same query that finds them — so broadcasting to N providers needs no
// per-provider preference lookup afterwards. (userRole is @@unique on
// [userId, role], so a provider appears at most once.)
async function findMatchingRecipients(request: {
  customerId: string;
  role: Role;
  provinceId: string;
  shootDate: Date | null;
  isDateFlexible: boolean;
}): Promise<BatchRecipient[]> {
  const candidates = await db.userRole.findMany({
    where: {
      userId: { not: request.customerId },
      role: request.role,
      active: true,
      verificationStatus: "VERIFIED",
      user: {
        deletedAt: null,
        acceptingBookings: true,
        profiles: {
          some: {
            role: request.role,
            isPublished: true,
            // The same notion of "in this province" that /browse and Fmap
            // use. A provider who set a province on their profile but never
            // opened the "Khu vực phục vụ" panel used to be invisible here
            // while appearing on the map in that very province (QA-03).
            ...providerCoversProvince(request.provinceId),
          },
        },
      },
    },
    select: {
      userId: true,
      user: { select: { notificationPreferences: true } },
    },
  });

  const recipients: BatchRecipient[] = candidates.map((c) => ({
    userId: c.userId,
    prefs: c.user.notificationPreferences as NotificationPreferences | null,
  }));

  if (recipients.length === 0) return [];
  if (request.isDateFlexible || !request.shootDate) {
    return recipients;
  }

  // Whole-day availability check — a best-effort filter (the request has
  // no specific time slot to check against), not the final word: a real
  // conflict is caught for real by createBooking() at accept time.
  //
  // Batched (2 queries covering every candidate) instead of a per-
  // candidate loop — this runs on every new service request, against
  // every verified provider for that role/area.
  const shootDate = request.shootDate;
  const candidateIds = recipients.map((r) => r.userId);
  const [blockedRows, confirmedRows] = await Promise.all([
    wholeDayBlockedProviders(candidateIds, shootDate),
    db.booking.findMany({
      where: {
        providerId: { in: candidateIds },
        status: "CONFIRMED",
        date: shootDate,
      },
      select: { providerId: true },
    }),
  ]);
  const unavailableIds = new Set([
    ...blockedRows,
    ...confirmedRows.map((r) => r.providerId),
  ]);
  return recipients.filter((r) => !unavailableIds.has(r.userId));
}

type MatchableRequest = Pick<
  ServiceRequest,
  | "id"
  | "code"
  | "title"
  | "customerId"
  | "role"
  | "provinceId"
  | "shootDate"
  | "isDateFlexible"
>;

export type RequestMatchStage = "match" | "compose" | "write";

export type RequestMatchOutcome =
  | { status: "delivered"; matched: number; created: number }
  | {
      status: "failed";
      stage: RequestMatchStage;
      /** Rows stored before the failure (a batch can fail part-way). */
      created: number;
      error: unknown;
    };

export interface RequestMatchDeps {
  findRecipients: (request: MatchableRequest) => Promise<BatchRecipient[]>;
  composeText: (
    request: MatchableRequest,
  ) => Promise<{ title: string; message: string }>;
  writeInApp: typeof notifyInAppBatch;
  report: (
    request: MatchableRequest,
    outcome: Extract<RequestMatchOutcome, { status: "failed" }>,
  ) => void;
}

const defaultRequestMatchDeps: RequestMatchDeps = {
  findRecipients: findMatchingRecipients,
  composeText: async (request) => {
    const nt = await getRequestNotifyT("vi");
    return {
      title: nt("request.newMatch.title"),
      message: nt("request.newMatch.message", {
        title: request.title,
        code: request.code,
      }),
    };
  },
  writeInApp: (input) => notifyInAppBatch(input),
  // A handled failure still has to be seen. console.error is how the rest
  // of the service layer surfaces a handled failure (lib/email-transport.ts,
  // lib/cache.ts, services/email-verification.ts): it lands in the Vercel
  // runtime logs, which docs/ops/VAN-HANH-PRODUCTION.md §2 names as the
  // place to look for errors until an alerting service is set up. The tag
  // and requestId make a missed broadcast findable for a specific request.
  report: (request, outcome) => {
    console.error("[Service Request] Matched-provider notifications failed", {
      requestId: request.id,
      code: request.code,
      stage: outcome.stage,
      created: outcome.created,
      error: outcome.error,
    });
  },
};

// Ràng buộc #3 — thông báo chủ động cho provider phù hợp ngay khi có yêu
// cầu mới đăng (tạo mới hoặc đăng từ bản nháp).
//
// Delivery: one query finds the matching providers together with their
// notification preferences (plus the two batched availability queries when
// the date is fixed), then one createMany per NOTIFICATION_BATCH_SIZE rows.
// It used to be notify() per provider, awaited in turn: a preference read and
// an insert each, 2N round-trips for N providers. Who gets a row is
// unchanged — selectInAppRecipients applies the same feature gate and
// per-person in-app toggle notify() did. REQUEST_NEW_MATCH never emails.
//
// Completion policy, deliberately:
//  - Callers AWAIT this. It used to run as `void …catch(() => {})` after the
//    response was built, and on serverless the function can be frozen or
//    killed as soon as the response is sent, so the broadcast could simply
//    never happen — with the error swallowed, nobody would ever know.
//  - It never rejects. A failure at any stage becomes a returned
//    `{ status: "failed" }` outcome, so a caller that has already committed
//    the request can't be made to report that as a failed creation — the
//    request exists and the customer must not be told otherwise (a retry
//    would post a duplicate).
//  - Every failure is reported (see defaultRequestMatchDeps.report) and the
//    outcome is returned, so it's observable rather than silent.
export async function notifyMatchingProviders(
  request: MatchableRequest,
  // Any subset can be swapped (tests); the rest stay real, so a test can
  // fail one stage and still observe the real reporter.
  overrides: Partial<RequestMatchDeps> = {},
): Promise<RequestMatchOutcome> {
  const deps: RequestMatchDeps = { ...defaultRequestMatchDeps, ...overrides };
  let stage: RequestMatchStage = "match";
  try {
    const recipients = await deps.findRecipients(request);
    if (recipients.length === 0) {
      return { status: "delivered", matched: 0, created: 0 };
    }

    stage = "compose";
    const { title, message } = await deps.composeText(request);

    stage = "write";
    const data: Prisma.InputJsonValue = { requestId: request.id };
    const result = await deps.writeInApp({
      type: "REQUEST_NEW_MATCH",
      recipients,
      title,
      message,
      data,
    });
    return {
      status: "delivered",
      matched: recipients.length,
      created: result.created,
    };
  } catch (error) {
    const outcome = {
      status: "failed" as const,
      stage,
      // Only the write stage can have stored anything before failing.
      created: error instanceof NotificationBatchError ? error.created : 0,
      error,
    };
    try {
      deps.report(request, outcome);
    } catch {
      // Reporting must not turn a handled failure into a thrown one.
    }
    return outcome;
  }
}

export async function listOpportunitiesForProvider(userId: string, role: Role) {
  const userRole = await db.userRole.findUnique({
    where: { userId_role: { userId, role } },
  });
  if (!userRole?.active || userRole.verificationStatus !== "VERIFIED") {
    return [];
  }

  const profile = await db.profile.findUnique({
    where: { userId_role: { userId, role } },
    select: SERVICE_AREA_SELECT,
  });
  if (!profile) return [];

  // Resolved the same way /browse and Fmap resolve it, so a provider can no
  // longer be shown in a province by one surface and told there is nothing
  // for them there by another (QA-03).
  const provinceIds = profileProvinceIds(profile);

  return db.serviceRequest.findMany({
    where: {
      customerId: { not: userId },
      role,
      isDraft: false,
      status: { in: ["OPEN", "HAS_OFFERS"] },
      ...(profile.servesNationwide ? {} : { provinceId: { in: provinceIds } }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      province: { select: { name: true } },
      ward: { select: { name: true } },
      _count: { select: { offers: true } },
      offers: {
        where: { providerId: userId },
        select: { id: true, status: true },
      },
    },
    // No pagination UI on /dashboard/opportunities yet — caps an
    // otherwise-unbounded fetch of every open request nationwide
    // matching this provider's role/area.
    take: 50,
  });
}

export async function getOpportunityDetail(
  requestId: string,
  providerId: string,
  role: Role,
) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      province: { select: { name: true } },
      ward: { select: { name: true } },
      references: true,
      customer: {
        select: {
          firstName: true,
          name: true,
          username: true,
          // OAuth stores the Google account name on User.name. Public UI
          // must prefer the provider identity chosen in Profile.displayName.
          profiles: {
            where: { isPublished: true },
            select: { displayName: true, role: true },
            orderBy: { role: "asc" },
          },
        },
      },
      offers: {
        where: { providerId },
        select: {
          id: true,
          status: true,
          message: true,
          proposedPrice: true,
          proposedDate: true,
        },
      },
    },
  });
  // A customer may also have a provider role. Their own request must never
  // become an opportunity, and unmoderated/closed requests stay private
  // unless this provider has an existing offer to revisit from My Offers.
  assertProviderMayViewOpportunity(request, providerId, role);

  // Ràng buộc #1 — "Ghi AuditLog mỗi lần một provider xem chi tiết yêu
  // cầu." detailedAddress is never selected above, so there's nothing to
  // withhold — it simply isn't part of this query.
  await logAudit({
    actorId: providerId,
    action: "service_request_viewed",
    targetType: "service_request",
    targetId: requestId,
  });

  return request;
}

export interface CreateOfferInput {
  message?: string;
  proposedPrice: number;
  proposedDate?: string;
}

export async function createOffer(
  requestId: string,
  providerId: string,
  role: Role,
  input: CreateOfferInput,
) {
  const userRole = await db.userRole.findUnique({
    where: { userId_role: { userId: providerId, role } },
  });
  if (!userRole?.active || userRole.verificationStatus !== "VERIFIED") {
    throw new OfferError("You must be a verified provider to send offers", 403);
  }

  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
  });
  assertProviderMayOffer(request, providerId, role);

  const existing = await db.requestOffer.findUnique({
    where: { requestId_providerId: { requestId, providerId } },
  });
  if (existing && existing.status !== "WITHDRAWN") {
    throw new OfferError("You've already sent an offer for this request", 400);
  }

  const offer = existing
    ? await db.requestOffer.update({
        where: { id: existing.id },
        data: {
          message: input.message,
          proposedPrice: input.proposedPrice,
          proposedDate: input.proposedDate
            ? new Date(input.proposedDate)
            : null,
          status: "PENDING",
        },
      })
    : await db.requestOffer.create({
        data: {
          requestId,
          providerId,
          message: input.message,
          proposedPrice: input.proposedPrice,
          proposedDate: input.proposedDate
            ? new Date(input.proposedDate)
            : undefined,
        },
      });

  if (request.status === "OPEN") {
    await db.serviceRequest.update({
      where: { id: requestId },
      data: { status: "HAS_OFFERS" },
    });
  }

  const newOfferEmailT = await getRequestEmailT();
  const newOfferNt = await getRequestNotifyT();
  await notify({
    userId: request.customerId,
    type: "REQUEST_NEW_OFFER",
    title: newOfferNt("request.newOffer.title"),
    message: newOfferNt("request.newOffer.message", {
      title: request.title,
      code: request.code,
    }),
    data: { requestId },
    email: {
      subject: newOfferEmailT("requestNewOffer.subject"),
      html: requestNewOfferEmailHtml({
        t: newOfferEmailT,
        requestTitle: request.title,
        requestCode: request.code,
        requestUrl: requestUrlFor(requestId),
      }),
      dedupe: [requestId, "NEW_OFFER", offer.id],
    },
  });

  return offer;
}

export async function editOffer(
  offerId: string,
  providerId: string,
  input: CreateOfferInput,
) {
  const offer = await db.requestOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.providerId !== providerId) throw new OfferNotFoundError();
  if (offer.status !== "PENDING") {
    throw new OfferError("Only a pending offer can be edited", 400);
  }

  return db.requestOffer.update({
    where: { id: offerId },
    data: {
      message: input.message,
      proposedPrice: input.proposedPrice,
      proposedDate: input.proposedDate ? new Date(input.proposedDate) : null,
    },
  });
}

/**
 * A request shows "has offers" only while one is actually waiting. Once the
 * last pending offer is withdrawn or declined it goes back to OPEN, so it is
 * listed and nudged like any request still looking for someone — it used to
 * stay HAS_OFFERS with nothing left to choose from.
 */
async function reopenIfNoPendingOffers(requestId: string) {
  const pending = await db.requestOffer.count({
    where: { requestId, status: "PENDING" },
  });
  if (pending > 0) return;
  await db.serviceRequest.updateMany({
    where: { id: requestId, status: "HAS_OFFERS" },
    data: { status: "OPEN" },
  });
}

export async function withdrawOffer(offerId: string, providerId: string) {
  const offer = await db.requestOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.providerId !== providerId) throw new OfferNotFoundError();
  if (offer.status !== "PENDING") {
    throw new OfferError("Only a pending offer can be withdrawn", 400);
  }

  const withdrawn = await db.requestOffer.update({
    where: { id: offerId },
    data: { status: "WITHDRAWN" },
  });
  await reopenIfNoPendingOffers(offer.requestId);
  return withdrawn;
}

export async function listProviderOffers(providerId: string) {
  return db.requestOffer.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    include: {
      request: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          role: true,
          province: { select: { name: true } },
        },
      },
    },
    // No pagination UI on /dashboard/my-offers yet — caps an otherwise-
    // unbounded fetch of a provider's full offer history.
    take: 50,
  });
}

export interface AcceptOfferInput {
  date: string;
  startTime: string;
  locationType: "PROVIDER" | "CUSTOMER" | "OUTDOOR";
}

// Prompt G7's own literal text says "chấp nhận → tạo Booking qua đúng
// transitionBooking hiện có" — that's imprecise (transitionBooking only
// ever transitions an EXISTING booking's status, per its own comment in
// services/bookings.ts; it never creates one). The initial creation goes
// through createBooking() instead, keeping every one of its existing
// guarantees (notice window, pending-booking cap, availability) intact —
// this is still "no parallel booking flow," just via the correct one of
// the two existing functions.
export async function acceptOffer(
  offerId: string,
  customerId: string,
  input: AcceptOfferInput,
) {
  const offer = await db.requestOffer.findUnique({
    where: { id: offerId },
    include: { request: { include: { references: true } } },
  });
  if (!offer) throw new OfferNotFoundError();
  if (offer.request.customerId !== customerId) {
    throw new OfferError("You don't own this request", 403);
  }
  // Re-checked here, not just trusted from the initial page load — closes
  // the accept-vs-withdraw/expire race flagged in the design review.
  if (offer.status !== "PENDING") {
    throw new OfferError(
      "This offer is no longer available — it may have just been withdrawn or expired",
      400,
    );
  }

  let booking;
  try {
    booking = await createBooking(customerId, {
      providerId: offer.providerId,
      date: input.date,
      startTime: input.startTime,
      locationType: input.locationType,
      locationAddress: offer.request.detailedAddress ?? undefined,
      notes: offer.request.description ?? undefined,
      // Carried over with the description and address. Was hardcoded to
      // `undefined`, so a customer who attached reference photos/videos to
      // their request watched them vanish from the booking the moment they
      // accepted an offer — the one point where the provider actually needs
      // them. Every reference fits: request and booking share one limit
      // (MAX_REFERENCE_MEDIA), so nothing is dropped and the result is always
      // valid booking input. Pinned by reference-media-policy.test.ts.
      referenceImages: referenceMediaForBooking(offer.request.references),
      trustedReferenceMedia: true,
      // Server-trusted role from the moderated request. Public booking input
      // never accepts this field; it selects the role through its service.
      trustedRecipientRole: offer.request.role,
    });
  } catch (err) {
    if (err instanceof BookingActionError) {
      // Already translated: the booking's own reason (e.g. the slot was just
      // taken) is what the customer needs to read.
      throw new OfferError(
        await bookingErrorMessage(err),
        err.status as 400 | 403,
      );
    }
    throw err;
  }

  // createBooking() only ever prices a booking off a Service record —
  // there isn't one here (this is a custom, negotiated price), so
  // totalPrice/currency come from the accepted offer instead.
  booking = await db.booking.update({
    where: { id: booking.id },
    data: { totalPrice: offer.proposedPrice, currency: offer.currency },
  });

  const [, declinedOffers] = await db.$transaction([
    db.requestOffer.update({
      where: { id: offerId },
      data: { status: "ACCEPTED" },
    }),
    db.requestOffer.findMany({
      where: {
        requestId: offer.requestId,
        status: "PENDING",
        id: { not: offerId },
      },
      select: { id: true, providerId: true },
    }),
  ]);

  await db.$transaction([
    db.requestOffer.updateMany({
      where: { id: { in: declinedOffers.map((o) => o.id) } },
      data: { status: "DECLINED" },
    }),
    db.serviceRequest.update({
      where: { id: offer.requestId },
      data: {
        status: "FULFILLED",
        fulfilledByOfferId: offerId,
        bookingId: booking.id,
      },
    }),
  ]);

  const acceptEmailT = await getRequestEmailT();
  const acceptNt = await getRequestNotifyT();
  const requestLabels = {
    title: offer.request.title,
    code: offer.request.code,
  };
  await notify({
    userId: offer.providerId,
    type: "REQUEST_OFFER_ACCEPTED",
    title: acceptNt("request.offerAccepted.title"),
    message: acceptNt("request.offerAccepted.message", requestLabels),
    data: { requestId: offer.requestId, bookingId: booking.id },
    email: {
      subject: acceptEmailT("requestOfferAccepted.subject"),
      html: requestOfferAcceptedEmailHtml({
        t: acceptEmailT,
        requestTitle: offer.request.title,
        requestCode: offer.request.code,
        requestUrl: appUrl(`/dashboard/bookings/${booking.id}`),
      }),
      dedupe: [offer.requestId, "ACCEPTED", offer.id],
    },
  });

  for (const declined of declinedOffers) {
    await notify({
      userId: declined.providerId,
      type: "REQUEST_OFFER_DECLINED",
      title: acceptNt("request.offerNotChosen.title"),
      message: acceptNt("request.offerNotChosen.message", requestLabels),
      data: { requestId: offer.requestId },
      email: {
        subject: acceptEmailT("requestOfferDeclined.subject"),
        html: requestOfferDeclinedEmailHtml({
          t: acceptEmailT,
          requestTitle: offer.request.title,
          requestCode: offer.request.code,
          requestUrl: appUrl("/dashboard/my-offers"),
        }),
        dedupe: [offer.requestId, "DECLINED", declined.id],
      },
    });
  }

  return booking;
}

export async function declineOffer(offerId: string, customerId: string) {
  const offer = await db.requestOffer.findUnique({
    where: { id: offerId },
    include: { request: true },
  });
  if (!offer) throw new OfferNotFoundError();
  if (offer.request.customerId !== customerId) {
    throw new OfferError("You don't own this request", 403);
  }
  if (offer.status !== "PENDING") {
    throw new OfferError("Only a pending offer can be declined", 400);
  }

  await db.requestOffer.update({
    where: { id: offerId },
    data: { status: "DECLINED" as RequestOfferStatus },
  });
  await reopenIfNoPendingOffers(offer.requestId);

  const declineEmailT = await getRequestEmailT();
  const declineNt = await getRequestNotifyT();
  await notify({
    userId: offer.providerId,
    type: "REQUEST_OFFER_DECLINED",
    title: declineNt("request.offerDeclined.title"),
    message: declineNt("request.offerDeclined.message", {
      title: offer.request.title,
      code: offer.request.code,
    }),
    data: { requestId: offer.requestId },
    email: {
      subject: declineEmailT("requestOfferDeclined.subject"),
      html: requestOfferDeclinedEmailHtml({
        t: declineEmailT,
        requestTitle: offer.request.title,
        requestCode: offer.request.code,
        requestUrl: opportunityUrlFor(offer.requestId),
      }),
      dedupe: [offer.requestId, "DECLINED", offer.id],
    },
  });
}
