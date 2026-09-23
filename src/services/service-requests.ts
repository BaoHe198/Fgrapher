import type {
  ProfileCategory,
  Role,
  ServiceRequestStatus,
} from "@prisma/client";

import { getTranslations } from "next-intl/server";

import { appUrl } from "@/lib/app-url";
import { verifyReferenceMediaUpload } from "@/lib/cloudinary";
import { features } from "@/lib/features";
import { mediaKindFromUrl } from "@/lib/media-kind";
import { db } from "@/lib/db";
import { requestNoOffersEmailHtml } from "@/lib/email";
import { resolvePartyName } from "@/lib/party-name";
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
const ACTIVE_REQUEST_STATUSES: ServiceRequestStatus[] = [
  "PENDING_REVIEW",
  ...OPEN_STATUSES,
];

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

export class ServiceRequestReviewError extends Error {
  constructor(
    message: "not_found" | "already_reviewed",
    public status: 404 | 409,
  ) {
    super(message);
    this.name = "ServiceRequestReviewError";
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
  references?: { mediaUrl: string; publicId: string }[];
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
      where: {
        customerId,
        status: { in: ACTIVE_REQUEST_STATUSES },
        isDraft: false,
      },
    });
    if (openCount >= MAX_OPEN_REQUESTS_PER_CUSTOMER) {
      throw new ServiceRequestError(
        `You already have ${MAX_OPEN_REQUESTS_PER_CUSTOMER} open requests — wait for one to resolve before posting another`,
        400,
      );
    }
  }

  for (const reference of input.references ?? []) {
    await verifyReferenceMediaUpload({
      publicId: reference.publicId,
      url: reference.mediaUrl,
      userId: customerId,
      type: mediaKindFromUrl(reference.mediaUrl),
      purpose: "request",
    });
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
      status: input.isDraft ? "OPEN" : "PENDING_REVIEW",
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

  // A submitted request stays private until reviewServiceRequest approves
  // it. Matching providers are notified at approval time, never here.
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

  // Defense-in-depth, not the primary gate — createServiceRequestSchema/
  // updateDraftServiceRequestSchema's refine()s already block saving an
  // inconsistent budget or date range on every create/PATCH. This is the
  // one code path that flips isDraft without going through either schema
  // (no request body at all), so a request from before that fix shipped,
  // or any other future caller of this function, still can't go live
  // showing a provider a nonsensical "5.000.000 – 2.000.000" range.
  if (
    request.budgetMin !== null &&
    request.budgetMax !== null &&
    request.budgetMin > request.budgetMax
  ) {
    throw new ServiceRequestError(
      "Budget minimum can't be greater than the maximum",
      400,
    );
  }
  if (
    request.dateRangeStart &&
    request.dateRangeEnd &&
    request.dateRangeStart > request.dateRangeEnd
  ) {
    throw new ServiceRequestError(
      "Date range start can't be after the end",
      400,
    );
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
    where: {
      customerId,
      status: { in: ACTIVE_REQUEST_STATUSES },
      isDraft: false,
    },
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
      status: "PENDING_REVIEW",
      moderationReason: null,
      moderatedAt: null,
    },
    include: { references: true },
  });

  return published;
}

/**
 * Admin gate for public service requests. updateMany makes the transition
 * conditional, so two reviewers cannot both approve/reject the same row and
 * an approval notification is emitted at most once.
 */
export async function reviewServiceRequest({
  requestId,
  action,
  reason,
}: {
  requestId: string;
  action: "approve" | "reject";
  reason?: string;
}) {
  const exists = await db.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true },
  });
  if (!exists) throw new ServiceRequestReviewError("not_found", 404);

  const moderatedAt = new Date();
  const reviewed = await db.$transaction(async (tx) => {
    const update = await tx.serviceRequest.updateMany({
      where: {
        id: requestId,
        isDraft: false,
        status: "PENDING_REVIEW",
      },
      data:
        action === "approve"
          ? {
              status: "OPEN",
              moderationReason: null,
              moderatedAt,
              expiresAt: new Date(
                moderatedAt.getTime() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000,
              ),
            }
          : {
              status: "REJECTED",
              moderationReason: reason,
              moderatedAt,
            },
    });

    if (update.count !== 1) {
      throw new ServiceRequestReviewError("already_reviewed", 409);
    }

    const row = await tx.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { references: true },
    });

    // Approval and its Community identity are atomic: an approved request
    // can never be left out of the feed by a partial serverless execution.
    if (action === "approve") {
      await tx.post.upsert({
        where: { serviceRequestId: row.id },
        create: {
          userId: row.customerId,
          kind: "SERVICE_REQUEST",
          serviceRequestId: row.id,
        },
        update: { deletedAt: null },
      });
    }

    return row;
  });

  if (action === "approve") {
    // Awaited so serverless cannot freeze before delivery. The broadcaster
    // reports failures but never rejects, so an already-approved request is
    // never presented to the admin as if the status change had failed.
    await notifyMatchingProviders(reviewed);
  }

  return reviewed;
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
    // No pagination UI on /dashboard/requests yet — caps an otherwise-
    // unbounded fetch of a customer's full request history.
    take: 50,
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
              profiles: {
                where: { isPublished: true },
                select: { displayName: true, role: true },
              },
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
  if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) {
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
// Here the provider picks their own filters, so role/verification/profile
// pre-conditions are not enforced. A viewer's own requests remain visible
// for a complete system-wide list, but are marked so the UI routes them to
// customer management rather than the offer form.
export interface BrowsableRequestFilters {
  role?: Role;
  provinceId?: string;
  wardId?: string;
}

export async function listBrowsableRequests(
  filters: BrowsableRequestFilters,
  viewerId: string,
) {
  const requests = await db.serviceRequest.findMany({
    where: {
      isDraft: false,
      status: { in: OPEN_STATUSES },
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
      ...(filters.wardId ? { wardId: filters.wardId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      customerId: true,
      title: true,
      role: true,
      budgetMin: true,
      budgetMax: true,
      isDateFlexible: true,
      shootDate: true,
      createdAt: true,
      customer: {
        select: {
          firstName: true,
          name: true,
          username: true,
          profiles: {
            where: { isPublished: true },
            select: { displayName: true, role: true },
            orderBy: { role: "asc" },
          },
        },
      },
      province: { select: { name: true } },
      ward: { select: { name: true } },
      _count: { select: { offers: true } },
    },
    // No pagination UI on /requests (browse) yet — caps an otherwise-
    // unbounded fetch of every open request nationwide.
    take: 50,
  });

  return requests.map(({ customerId, customer, ...request }) => ({
    ...request,
    customerDisplayName: resolvePartyName(customer, ""),
    isOwner: customerId === viewerId,
  }));
}

// Admin queue combines requests awaiting a content decision with approved
// requests that still have no offers. OPEN (not HAS_OFFERS) already means
// zero offers because the first offer moves a request to HAS_OFFERS.
export async function listServiceRequestsForAdmin() {
  const include = {
    customer: {
      select: {
        firstName: true,
        name: true,
        email: true,
        username: true,
        profiles: {
          where: { isPublished: true },
          select: { displayName: true, role: true },
          orderBy: { role: "asc" as const },
        },
      },
    },
    province: { select: { name: true } },
    ward: { select: { name: true } },
    references: { select: { mediaUrl: true } },
  };

  // Keep the two limits independent. A large backlog of old, approved
  // requests must never consume the result cap and hide newer moderation
  // work from admins.
  const [pending, unclaimed] = await Promise.all([
    db.serviceRequest.findMany({
      where: { isDraft: false, status: "PENDING_REVIEW" },
      orderBy: { createdAt: "asc" },
      include,
      take: 100,
    }),
    db.serviceRequest.findMany({
      where: { isDraft: false, status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include,
      take: 100,
    }),
  ]);

  return { pending, unclaimed };
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

  // Cron-triggered — no request context, explicit "vi" locale.
  const [emailT, nt] = await Promise.all([
    getTranslations({ locale: "vi", namespace: "libServices.email" }),
    getTranslations({ locale: "vi", namespace: "libServices.notifications" }),
  ]);

  for (const request of stale) {
    await notify({
      userId: request.customerId,
      type: "REQUEST_NO_OFFERS_48H",
      title: nt("request.noOffers.title"),
      message: nt("request.noOffers.message", {
        title: request.title,
        code: request.code,
      }),
      data: { requestId: request.id },
      email: {
        subject: emailT("requestNoOffers.subject"),
        html: requestNoOffersEmailHtml({
          t: emailT,
          requestTitle: request.title,
          requestCode: request.code,
          requestUrl: appUrl(`/dashboard/requests/${request.id}`),
        }),
        dedupe: [request.id, "NUDGE"],
      },
    });
    await db.serviceRequest.update({
      where: { id: request.id },
      data: { noOffersNudgedAt: new Date() },
    });
  }

  return { nudged: stale.length };
}
