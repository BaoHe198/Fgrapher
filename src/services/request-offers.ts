import type { RequestOfferStatus, Role, ServiceRequest } from "@prisma/client";

import { db } from "@/lib/db";
import { logAudit } from "@/services/compliance";
import { findConfirmedBookingConflicts } from "@/services/availability";
import { BookingActionError, createBooking } from "@/services/bookings";
import { notify } from "@/services/notification";

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

// Lọc cứng (thiết kế đã duyệt, mục 03) — mọi điều kiện đều phải đạt để một
// provider được coi là ứng viên, dùng chung cho cả feed "Yêu cầu phù hợp"
// lẫn danh sách nhận thông báo chủ động khi có yêu cầu mới. KHÔNG lọc theo
// gói trả phí đang active — quyết định của chủ dự án, mở cho provider trải
// nghiệm ở giai đoạn MVP (chỉ role + xác minh danh tính là bắt buộc, vì lý
// do pháp lý/an toàn không thể bỏ).
async function findMatchingProviderIds(request: {
  role: Role;
  provinceId: string;
  shootDate: Date | null;
  isDateFlexible: boolean;
}) {
  const candidates = await db.userRole.findMany({
    where: {
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
            OR: [
              { servesNationwide: true },
              { serviceAreas: { some: { provinceId: request.provinceId } } },
            ],
          },
        },
      },
    },
    select: { userId: true },
  });

  if (candidates.length === 0) return [];
  if (request.isDateFlexible || !request.shootDate) {
    return candidates.map((c) => c.userId);
  }

  // Whole-day availability check — a best-effort filter (the request has
  // no specific time slot to check against), not the final word: a real
  // conflict is caught for real by createBooking() at accept time.
  const shootDate = request.shootDate;
  const available: string[] = [];
  for (const { userId } of candidates) {
    const [blocked, conflicts] = await Promise.all([
      db.blockedDate.findFirst({
        where: { userId, date: shootDate, startTime: null, endTime: null },
        select: { id: true },
      }),
      findConfirmedBookingConflicts(userId, shootDate),
    ]);
    if (!blocked && conflicts.length === 0) available.push(userId);
  }
  return available;
}

// Ràng buộc #3 — thông báo chủ động cho provider phù hợp ngay khi có yêu
// cầu mới. Gọi từ services/service-requests.ts's createServiceRequest,
// fire-and-forget — không được để một lỗi thông báo làm hỏng việc tạo yêu
// cầu.
export async function notifyMatchingProviders(
  request: Pick<
    ServiceRequest,
    | "id"
    | "code"
    | "title"
    | "role"
    | "provinceId"
    | "shootDate"
    | "isDateFlexible"
  >,
) {
  const providerIds = await findMatchingProviderIds(request);
  for (const userId of providerIds) {
    await notify({
      userId,
      type: "REQUEST_NEW_MATCH",
      title: "Có yêu cầu mới phù hợp với bạn",
      message: `"${request.title}" (${request.code}) đang tìm provider — xem chi tiết và gửi đề nghị.`,
      data: { requestId: request.id },
    });
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
    select: {
      servesNationwide: true,
      serviceAreas: { select: { provinceId: true } },
    },
  });
  if (!profile) return [];

  const provinceIds = profile.serviceAreas.map((a) => a.provinceId);

  return db.serviceRequest.findMany({
    where: {
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
      customer: { select: { firstName: true, name: true } },
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
  if (!request || request.isDraft) throw new OfferNotFoundError();
  if (request.role !== role) throw new OfferNotFoundError();

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
  if (!request || request.isDraft || request.role !== role) {
    throw new OfferNotFoundError();
  }
  if (request.status !== "OPEN" && request.status !== "HAS_OFFERS") {
    throw new OfferError("This request is no longer accepting offers", 400);
  }

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

  await notify({
    userId: request.customerId,
    type: "REQUEST_NEW_OFFER",
    title: "Có đề nghị mới",
    message: `Yêu cầu "${request.title}" (${request.code}) vừa nhận được một đề nghị mới.`,
    data: { requestId },
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

export async function withdrawOffer(offerId: string, providerId: string) {
  const offer = await db.requestOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.providerId !== providerId) throw new OfferNotFoundError();
  if (offer.status !== "PENDING") {
    throw new OfferError("Only a pending offer can be withdrawn", 400);
  }

  return db.requestOffer.update({
    where: { id: offerId },
    data: { status: "WITHDRAWN" },
  });
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
    include: { request: true },
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
      referenceImages: undefined,
    });
  } catch (err) {
    if (err instanceof BookingActionError) {
      throw new OfferError(err.message, err.status as 400 | 403);
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

  await notify({
    userId: offer.providerId,
    type: "REQUEST_OFFER_ACCEPTED",
    title: "Đề nghị của bạn đã được chấp nhận",
    message: `Yêu cầu "${offer.request.title}" (${offer.request.code}) đã chọn bạn — kiểm tra lịch đặt mới.`,
    data: { requestId: offer.requestId, bookingId: booking.id },
  });

  for (const declined of declinedOffers) {
    await notify({
      userId: declined.providerId,
      type: "REQUEST_OFFER_DECLINED",
      title: "Yêu cầu đã chọn provider khác",
      message: `Yêu cầu "${offer.request.title}" (${offer.request.code}) đã chọn một đề nghị khác.`,
      data: { requestId: offer.requestId },
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

  await notify({
    userId: offer.providerId,
    type: "REQUEST_OFFER_DECLINED",
    title: "Đề nghị đã bị từ chối",
    message: `Đề nghị của bạn cho yêu cầu "${offer.request.title}" (${offer.request.code}) đã bị từ chối.`,
    data: { requestId: offer.requestId },
  });
}
