import type {
  ProfileCategory,
  Role,
  ServiceRequestStatus,
} from "@prisma/client";

import { features } from "@/lib/features";
import { db } from "@/lib/db";
import { notify } from "@/services/notification";
import { notifyMatchingProviders } from "@/services/request-offers";

// Prompt G7 — reverse marketplace. Simplified from the source prompt's
// literal schema per the project owner's explicit decision: one role per
// request, one accepted offer — see prisma/schema.prisma's comment on the
// SERVICE REQUESTS section for the full rationale.
export const REQUEST_TTL_DAYS = 7;
const MAX_OPEN_REQUESTS_PER_CUSTOMER = 3;
const NO_OFFERS_NUDGE_HOURS = 48;
const OPEN_STATUSES: ServiceRequestStatus[] = ["OPEN", "HAS_OFFERS"];

export class ServiceRequestError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "ServiceRequestError";
  }
}

export class ServiceRequestNotFoundError extends ServiceRequestError {
  constructor() {
    super("Service request not found", 404);
  }
}

export class ServiceRequestNotOwnedError extends ServiceRequestError {
  constructor() {
    super("You don't own this request", 403);
  }
}

async function generateRequestCode() {
  const year = new Date().getFullYear();
  // Best-effort sequential number, not a hard guarantee under concurrent
  // creates — `code` is @unique, so a collision throws P2002 and the
  // caller retries with the next count rather than silently duplicating.
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.serviceRequest.count({
      where: { code: { startsWith: `YC-${year}-` } },
    });
    const code = `YC-${year}-${String(count + 1 + attempt).padStart(5, "0")}`;
    const existing = await db.serviceRequest.findUnique({ where: { code } });
    if (!existing) return code;
  }
  // Astronomically unlikely at this app's scale, but never loop forever.
  return `YC-${year}-${Date.now()}`;
}

export interface CreateServiceRequestInput {
  title: string;
  description?: string;
  role: Role;
  categories: ProfileCategory[];
  shootDate?: string;
  isDateFlexible: boolean;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  provinceId: string;
  wardId?: string | null;
  areaNote?: string;
  detailedAddress?: string;
  budgetMin?: number;
  budgetMax?: number;
  references?: { mediaUrl: string; publicId?: string }[];
  isDraft: boolean;
}

export async function createServiceRequest(
  customerId: string,
  input: CreateServiceRequestInput,
) {
  // Ràng buộc #2 (chống yêu cầu ảo) — chỉ tài khoản đã xác thực số điện
  // thoại mới đăng được yêu cầu. Drafts are exempt (nothing is visible to
  // providers yet), only publishing is gated.
  if (!input.isDraft) {
    if (features.phoneVerificationRequired) {
      const customer = await db.user.findUnique({
        where: { id: customerId },
        select: { phoneVerified: true },
      });
      if (!customer?.phoneVerified) {
        throw new ServiceRequestError(
          "Verify your phone number before posting a request",
          403,
        );
      }
    }

    const openCount = await db.serviceRequest.count({
      where: { customerId, status: { in: OPEN_STATUSES }, isDraft: false },
    });
    if (openCount >= MAX_OPEN_REQUESTS_PER_CUSTOMER) {
      throw new ServiceRequestError(
        `You already have ${MAX_OPEN_REQUESTS_PER_CUSTOMER} open requests — wait for one to resolve before posting another`,
        400,
      );
    }
  }

  const code = await generateRequestCode();
  const expiresAt = new Date(
    Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const request = await db.serviceRequest.create({
    data: {
      code,
      customerId,
      title: input.title,
      description: input.description,
      role: input.role,
      categories: input.categories,
      shootDate: input.shootDate ? new Date(input.shootDate) : undefined,
      isDateFlexible: input.isDateFlexible,
      dateRangeStart: input.dateRangeStart
        ? new Date(input.dateRangeStart)
        : undefined,
      dateRangeEnd: input.dateRangeEnd
        ? new Date(input.dateRangeEnd)
        : undefined,
      provinceId: input.provinceId,
      wardId: input.wardId,
      areaNote: input.areaNote,
      detailedAddress: input.detailedAddress,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      isDraft: input.isDraft,
      expiresAt,
      references: input.references?.length
        ? {
            create: input.references.map((r) => ({
              mediaUrl: r.mediaUrl,
              publicId: r.publicId,
            })),
          }
        : undefined,
    },
    include: { references: true },
  });

  // Ràng buộc #3 (yêu cầu không ai nhận) — thông báo chủ động ngay khi
  // đăng, không đợi cron. Fire-and-forget: a matching/notification hiccup
  // must never fail the request creation itself.
  if (!input.isDraft) {
    void notifyMatchingProviders(request).catch(() => {});
  }

  return request;
}

export async function updateDraftServiceRequest(
  requestId: string,
  customerId: string,
  input: Partial<CreateServiceRequestInput>,
) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) throw new ServiceRequestNotFoundError();
  if (request.customerId !== customerId)
    throw new ServiceRequestNotOwnedError();
  if (!request.isDraft) {
    throw new ServiceRequestError("This request has already been posted", 400);
  }

  return db.serviceRequest.update({
    where: { id: requestId },
    data: {
      title: input.title,
      description: input.description,
      role: input.role,
      categories: input.categories,
      shootDate: input.shootDate ? new Date(input.shootDate) : undefined,
      isDateFlexible: input.isDateFlexible,
      dateRangeStart: input.dateRangeStart
        ? new Date(input.dateRangeStart)
        : undefined,
      dateRangeEnd: input.dateRangeEnd
        ? new Date(input.dateRangeEnd)
        : undefined,
      provinceId: input.provinceId,
      wardId: input.wardId,
      areaNote: input.areaNote,
      detailedAddress: input.detailedAddress,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
    },
  });
}

// Publishing a draft goes through the same phone/limit checks as a fresh
// post — re-running createServiceRequest's checks here rather than
// duplicating them would mean creating a second row, so this is its own
// small function instead.
export async function publishDraftServiceRequest(
  requestId: string,
  customerId: string,
) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) throw new ServiceRequestNotFoundError();
  if (request.customerId !== customerId)
    throw new ServiceRequestNotOwnedError();
  if (!request.isDraft) {
    throw new ServiceRequestError("This request has already been posted", 400);
  }

  if (features.phoneVerificationRequired) {
    const customer = await db.user.findUnique({
      where: { id: customerId },
      select: { phoneVerified: true },
    });
    if (!customer?.phoneVerified) {
      throw new ServiceRequestError(
        "Verify your phone number before posting a request",
        403,
      );
    }
  }

  const openCount = await db.serviceRequest.count({
    where: { customerId, status: { in: OPEN_STATUSES }, isDraft: false },
  });
  if (openCount >= MAX_OPEN_REQUESTS_PER_CUSTOMER) {
    throw new ServiceRequestError(
      `You already have ${MAX_OPEN_REQUESTS_PER_CUSTOMER} open requests — wait for one to resolve before posting another`,
      400,
    );
  }

  const published = await db.serviceRequest.update({
    where: { id: requestId },
    data: {
      isDraft: false,
      expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    include: { references: true },
  });

  void notifyMatchingProviders(published).catch(() => {});

  return published;
}

export async function listCustomerRequests(customerId: string) {
  const requests = await db.serviceRequest.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      province: { select: { name: true } },
      ward: { select: { name: true } },
      _count: { select: { offers: { where: { status: "PENDING" } } } },
    },
  });
  return requests;
}

export async function getServiceRequestForCustomer(
  requestId: string,
  customerId: string,
) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    include: {
      province: { select: { name: true } },
      ward: { select: { name: true } },
      references: true,
      offers: {
        orderBy: { createdAt: "asc" },
        include: {
          provider: {
            select: {
              id: true,
              firstName: true,
              name: true,
              avatar: true,
              username: true,
              // Not filtered by the request's own role here — the UI
              // matches request.role against this list itself, since a
              // provider can hold several roles and only one is relevant
              // to this particular offer.
              roles: { select: { role: true, verificationStatus: true } },
            },
          },
        },
      },
    },
  });
  if (!request) throw new ServiceRequestNotFoundError();
  if (request.customerId !== customerId)
    throw new ServiceRequestNotOwnedError();
  return request;
}

export async function cancelServiceRequest(
  requestId: string,
  customerId: string,
) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) throw new ServiceRequestNotFoundError();
  if (request.customerId !== customerId)
    throw new ServiceRequestNotOwnedError();
  if (request.status === "FULFILLED" || request.status === "CANCELLED") {
    throw new ServiceRequestError("This request can't be cancelled", 400);
  }

  await db.$transaction([
    db.serviceRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    }),
    db.requestOffer.updateMany({
      where: { requestId, status: "PENDING" },
      data: { status: "DECLINED" },
    }),
  ]);
}

// Top-nav "Danh sách yêu cầu" — a system-wide, filterable browse of every
// open request, distinct from listOpportunitiesForProvider's strict
// auto-match feed (verified role + service area + same-day availability).
// Here the provider picks their own filters, so no pre-conditions on the
// viewer are enforced — matches getOpportunityDetail's own "viewing is
// open, only createOffer gates on verification" stance.
export interface BrowsableRequestFilters {
  role?: Role;
  provinceId?: string;
  wardId?: string;
}

export async function listBrowsableRequests(filters: BrowsableRequestFilters) {
  return db.serviceRequest.findMany({
    where: {
      isDraft: false,
      status: { in: OPEN_STATUSES },
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
      ...(filters.wardId ? { wardId: filters.wardId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      province: { select: { name: true } },
      ward: { select: { name: true } },
      _count: { select: { offers: true } },
    },
  });
}

// Ràng buộc #3 — "Trang quản trị hiện các yêu cầu chưa ai nhận để đội
// vận hành can thiệp thủ công." OPEN (not HAS_OFFERS) already means zero
// offers, since a request leaves OPEN the moment its first offer arrives
// — see createOffer in services/request-offers.ts.
export async function listUnclaimedRequests() {
  return db.serviceRequest.findMany({
    where: { status: "OPEN", isDraft: false },
    orderBy: { createdAt: "asc" },
    include: {
      customer: { select: { firstName: true, name: true, email: true } },
      province: { select: { name: true } },
      ward: { select: { name: true } },
    },
  });
}

// Called by /api/cron/expire-service-requests — never touches a FULFILLED
// or already-CANCELLED request, and only ever moves OPEN/HAS_OFFERS
// forward once past expiresAt. A FULFILLED request's Booking is
// completely untouched by this (it isn't even queried).
export async function expireOverdueRequests() {
  const overdue = await db.serviceRequest.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      isDraft: false,
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
  });
  if (overdue.length === 0) return { expired: 0 };

  await db.$transaction([
    db.serviceRequest.updateMany({
      where: { id: { in: overdue.map((r) => r.id) } },
      data: { status: "EXPIRED" },
    }),
    db.requestOffer.updateMany({
      where: { requestId: { in: overdue.map((r) => r.id) }, status: "PENDING" },
      data: { status: "DECLINED" },
    }),
  ]);

  return { expired: overdue.length };
}

// Ràng buộc #3 — "Sau 48h không có đề nghị nào: thông báo cho khách."
// noOffersNudgedAt guards against re-notifying every cron run.
export async function nudgeUnansweredRequests() {
  const cutoff = new Date(Date.now() - NO_OFFERS_NUDGE_HOURS * 60 * 60 * 1000);
  const stale = await db.serviceRequest.findMany({
    where: {
      status: "OPEN",
      isDraft: false,
      createdAt: { lt: cutoff },
      noOffersNudgedAt: null,
    },
    select: { id: true, code: true, customerId: true, title: true },
  });

  for (const request of stale) {
    await notify({
      userId: request.customerId,
      type: "REQUEST_NO_OFFERS_48H",
      title: "Chưa có provider nào chào giá",
      message: `Yêu cầu "${request.title}" (${request.code}) chưa nhận được đề nghị nào sau 48 giờ. Cân nhắc nới ngân sách hoặc đặt lịch trực tiếp.`,
      data: { requestId: request.id },
    });
    await db.serviceRequest.update({
      where: { id: request.id },
      data: { noOffersNudgedAt: new Date() },
    });
  }

  return { nudged: stale.length };
}
