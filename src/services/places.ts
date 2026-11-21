import type {
  ModerationStatus,
  PlaceKind,
  Prisma,
  ProfileCategory,
} from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { PROVIDER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { verifyPlacePhotoUpload } from "@/lib/media/cloudinary";
import {
  boxAround,
  distanceMeters,
  DUPLICATE_RADIUS_M,
  MAX_PENDING_PLACES,
  MAX_PLACE_PHOTOS,
  NEARBY_PROVIDER_RADIUS_KM,
  placeHref,
  placeSlug,
} from "@/lib/places";
import { ACTIVE_SERVICE_PRICES, startingPrice } from "@/lib/starting-price";
import type {
  AdminPlaceUpdateInput,
  PlaceFieldsInput,
  PlacePhotoInput,
  PlaceProposalInput,
} from "@/lib/validations/place";
import {
  escapeLike,
  foldVietnamese,
  SQL_FOLD_FROM,
  SQL_FOLD_TO,
} from "@/lib/vietnam/fold";
import { notify } from "@/services/notification";
import { PUBLIC_USER_FILTER } from "@/services/search";

// Photo spots ("địa điểm chụp", project owner 20/11/2026). See the Place
// model in prisma/schema.prisma for what a spot is and who may add one.

export class PlaceError extends Error {
  constructor(
    public readonly code:
      | "not_allowed"
      | "not_found"
      | "not_editable"
      | "too_many_pending"
      | "duplicate"
      | "bad_area"
      | "no_photo"
      | "upload_unverified"
      | "already_reviewed"
      | "merge_self",
    public readonly status = 400,
    /** For "duplicate": the spots it is probably the same as. */
    public readonly nearby: NearbyPlace[] = [],
  ) {
    super(code);
    this.name = "PlaceError";
  }
}

/** A spot visitors may see: approved, not deleted, not merged away. */
export const PUBLIC_PLACE = {
  reviewStatus: "APPROVED",
  deletedAt: null,
  mergedIntoId: null,
} as const satisfies Prisma.PlaceWhereInput;

const APPROVED_PHOTO = {
  moderationStatus: "APPROVED",
  deletedAt: null,
} as const satisfies Prisma.PlaceMediaWhereInput;

const APPROVED_ALBUM_IMAGE = {
  type: "IMAGE",
  moderationStatus: "APPROVED",
  deletedAt: null,
} as const satisfies Prisma.ProfileMediaWhereInput;

// ---------------------------------------------------------------------------
// Who may propose
// ---------------------------------------------------------------------------

async function isAdmin(userId: string) {
  return Boolean(
    await db.userRole.findFirst({
      where: { userId, role: "ADMIN", active: true },
      select: { id: true },
    }),
  );
}

/**
 * An admin, or a provider whose identity is verified for an active role —
 * the same bar as going public (CLAUDE.md rule 5). An unverified account
 * proposing spots would be an easy way to advertise a café under a name
 * nobody can trace.
 */
export async function canProposePlaces(userId: string) {
  const role = await db.userRole.findFirst({
    where: {
      userId,
      active: true,
      OR: [
        { role: "ADMIN" },
        { role: { in: PROVIDER_ROLES }, verificationStatus: "VERIFIED" },
      ],
    },
    select: { id: true },
  });
  return Boolean(role);
}

// ---------------------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------------------

export interface NearbyPlace {
  id: string;
  name: string;
  reviewStatus: ModerationStatus;
  distanceM: number;
  href: string | null;
}

/** Spots (approved or waiting) within DUPLICATE_RADIUS_M of a point. */
export async function nearbyPlaces(
  point: { latitude: number; longitude: number },
  excludeId?: string,
): Promise<NearbyPlace[]> {
  const box = boxAround(point, DUPLICATE_RADIUS_M);
  const rows = await db.place.findMany({
    where: {
      deletedAt: null,
      mergedIntoId: null,
      reviewStatus: { in: ["PENDING", "APPROVED"] },
      latitude: { gte: box.south, lte: box.north },
      longitude: { gte: box.west, lte: box.east },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      reviewStatus: true,
      latitude: true,
      longitude: true,
      province: { select: { code: true } },
    },
    take: 20,
  });
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      reviewStatus: row.reviewStatus,
      distanceM: Math.round(distanceMeters(point, row)),
      href: row.reviewStatus === "APPROVED" ? placeHref(row) : null,
    }))
    .filter((row) => row.distanceM <= DUPLICATE_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);
}

async function checkArea(
  input: Pick<PlaceFieldsInput, "provinceId" | "wardId">,
) {
  const province = await db.province.findUnique({
    where: { id: input.provinceId },
    select: { id: true },
  });
  if (!province) throw new PlaceError("bad_area");
  if (input.wardId) {
    const ward = await db.ward.findFirst({
      where: { id: input.wardId, provinceId: input.provinceId },
      select: { id: true },
    });
    if (!ward) throw new PlaceError("bad_area");
  }
}

async function verifyPhotos(userId: string, photos: PlacePhotoInput[]) {
  for (const photo of photos) {
    try {
      await verifyPlacePhotoUpload({
        publicId: photo.publicId,
        url: photo.url,
        userId,
      });
    } catch {
      throw new PlaceError("upload_unverified");
    }
  }
}

/** A slug free in the province: name, then name-2, name-3… */
async function freeSlug(
  tx: Prisma.TransactionClient,
  provinceId: string,
  name: string,
  excludeId?: string,
) {
  const base = placeSlug(name);
  const taken = new Set(
    (
      await tx.place.findMany({
        where: {
          provinceId,
          slug: { startsWith: base },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { slug: true },
      })
    ).map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

function factsData(input: Partial<PlaceFieldsInput>) {
  const data: Prisma.PlaceUncheckedUpdateInput = {};
  const keys = [
    "name",
    "description",
    "kind",
    "categories",
    "provinceId",
    "wardId",
    "address",
    "latitude",
    "longitude",
    "bestTimeNote",
    "bestMonths",
    "entryFeeVnd",
    "feeNote",
    "permitRequired",
    "rulesNote",
    "crowdNote",
    "parkingNote",
  ] as const;
  for (const key of keys) {
    if (input[key] !== undefined) {
      (data as Record<string, unknown>)[key] = input[key];
    }
  }
  return data;
}

/**
 * A provider (or an admin) proposes a new spot. It waits for an admin's
 * review; its photos wait with it.
 */
export async function proposePlace(userId: string, input: PlaceProposalInput) {
  if (!(await canProposePlaces(userId))) {
    throw new PlaceError("not_allowed", 403);
  }
  if (input.photos.length === 0) throw new PlaceError("no_photo");
  await checkArea(input);

  const pending = await db.place.count({
    where: { submittedById: userId, reviewStatus: "PENDING", deletedAt: null },
  });
  if (pending >= MAX_PENDING_PLACES && !(await isAdmin(userId))) {
    throw new PlaceError("too_many_pending", 429);
  }

  if (!input.notDuplicate) {
    const nearby = await nearbyPlaces(input);
    if (nearby.length > 0) throw new PlaceError("duplicate", 409, nearby);
  }

  await verifyPhotos(userId, input.photos);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const place = await tx.place.create({
      data: {
        ...(factsData(input) as Prisma.PlaceUncheckedCreateInput),
        slug: await freeSlug(tx, input.provinceId, input.name),
        submittedById: userId,
      },
    });
    await tx.placeMedia.createMany({
      data: input.photos.map((photo, index) => ({
        placeId: place.id,
        uploaderId: userId,
        url: photo.url,
        publicId: photo.publicId,
        width: photo.width ?? null,
        height: photo.height ?? null,
        caption: photo.caption ?? null,
        order: index,
        rightsConfirmedAt: now,
      })),
    });
    return place;
  });
}

/**
 * The proposer edits a spot that is still waiting, or that was sent back —
 * which puts it back in the queue. An approved spot is the admins' to edit
 * (anyone can report wrong facts on its page).
 */
export async function updatePlaceProposal(
  userId: string,
  placeId: string,
  input: PlaceProposalInput,
) {
  const place = await db.place.findFirst({
    where: { id: placeId, submittedById: userId, deletedAt: null },
    include: { media: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!place) throw new PlaceError("not_found", 404);
  if (place.reviewStatus !== "PENDING" && place.reviewStatus !== "REJECTED") {
    throw new PlaceError("not_editable", 409);
  }
  await checkArea(input);

  const keep = new Set(
    input.keepPhotoIds.filter((id) => place.media.some((m) => m.id === id)),
  );
  if (keep.size + input.photos.length === 0) throw new PlaceError("no_photo");
  if (keep.size + input.photos.length > MAX_PLACE_PHOTOS) {
    throw new PlaceError("no_photo");
  }
  if (!input.notDuplicate) {
    const nearby = await nearbyPlaces(input, placeId);
    if (nearby.length > 0) throw new PlaceError("duplicate", 409, nearby);
  }
  await verifyPhotos(userId, input.photos);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const updated = await tx.place.update({
      where: { id: placeId },
      data: {
        ...factsData(input),
        slug:
          input.name !== place.name || input.provinceId !== place.provinceId
            ? await freeSlug(tx, input.provinceId, input.name, placeId)
            : undefined,
        reviewStatus: "PENDING",
        moderationNote: null,
        moderatedAt: null,
        moderatedBy: null,
      },
    });
    await tx.placeMedia.updateMany({
      where: { placeId, deletedAt: null, id: { notIn: [...keep] } },
      data: { deletedAt: now },
    });
    // A photo sent back with the spot gets another look with it.
    await tx.placeMedia.updateMany({
      where: { placeId, id: { in: [...keep] }, moderationStatus: "REJECTED" },
      data: { moderationStatus: "PENDING", moderationNote: null },
    });
    if (input.photos.length > 0) {
      await tx.placeMedia.createMany({
        data: input.photos.map((photo, index) => ({
          placeId,
          uploaderId: userId,
          url: photo.url,
          publicId: photo.publicId,
          width: photo.width ?? null,
          height: photo.height ?? null,
          caption: photo.caption ?? null,
          order: keep.size + index,
          rightsConfirmedAt: now,
        })),
      });
    }
    return updated;
  });
}

/** The proposer withdraws a spot that is not public yet. */
export async function withdrawPlaceProposal(userId: string, placeId: string) {
  const result = await db.place.updateMany({
    where: {
      id: placeId,
      submittedById: userId,
      deletedAt: null,
      reviewStatus: { in: ["PENDING", "REJECTED"] },
    },
    data: { deletedAt: new Date() },
  });
  if (result.count !== 1) throw new PlaceError("not_editable", 409);
}

export async function listMyPlaces(userId: string) {
  const rows = await db.place.findMany({
    where: { submittedById: userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      province: { select: { code: true, name: true } },
      media: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        take: 1,
        select: { url: true },
      },
      _count: { select: { albums: { where: { deletedAt: null } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    provinceName: row.province.name,
    reviewStatus: row.reviewStatus,
    moderationNote: row.moderationNote,
    thumbnailUrl: row.media[0]?.url ?? null,
    albumCount: row._count.albums,
    href: row.reviewStatus === "APPROVED" ? placeHref(row) : null,
    createdAt: row.createdAt,
  }));
}

/** A proposal as its author edits it. */
export async function getMyPlaceForEdit(userId: string, placeId: string) {
  return db.place.findFirst({
    where: { id: placeId, submittedById: userId, deletedAt: null },
    include: {
      media: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        select: {
          id: true,
          url: true,
          width: true,
          height: true,
          caption: true,
          moderationStatus: true,
          moderationNote: true,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function countPendingPlaces() {
  return db.place.count({
    where: { reviewStatus: "PENDING", deletedAt: null },
  });
}

export async function listPlacesForAdmin({
  status,
  q,
  provinceCode,
  attention = false,
  page = 1,
}: {
  status: ModerationStatus;
  q?: string;
  provinceCode?: string;
  /** Only spots with an open report or not shooting-ready. */
  attention?: boolean;
  page?: number;
}) {
  const PAGE = 30;
  const ids = q ? await placeIdsMatching(q, { includeUnapproved: true }) : null;
  const reported = await openPlaceReports();
  const where: Prisma.PlaceWhereInput = {
    reviewStatus: status,
    deletedAt: null,
    ...(ids ? { id: { in: ids } } : {}),
    ...(provinceCode ? { province: { code: provinceCode } } : {}),
    ...(attention
      ? {
          OR: [
            { id: { in: [...reported.keys()] } },
            { operatingStatus: { not: "OPEN" } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.place.count({ where }),
    db.place.findMany({
      where,
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: {
        province: { select: { name: true, code: true } },
        submittedBy: {
          select: { id: true, name: true, email: true, username: true },
        },
        media: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          take: 1,
          select: { url: true },
        },
        _count: {
          select: {
            media: { where: { deletedAt: null, moderationStatus: "PENDING" } },
          },
        },
      },
    }),
  ]);
  return {
    places: rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      provinceName: row.province.name,
      operatingStatus: row.operatingStatus,
      submittedBy: row.submittedBy,
      thumbnailUrl: row.media[0]?.url ?? null,
      pendingPhotos: row._count.media,
      openReports: reported.get(row.id) ?? 0,
      lastVerifiedAt: row.lastVerifiedAt,
      createdAt: row.createdAt,
      href: row.reviewStatus === "APPROVED" ? placeHref(row) : null,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE)),
  };
}

/** Open reports per spot, from the shared report queue. */
async function openPlaceReports() {
  const groups = await db.report.groupBy({
    by: ["targetId"],
    where: { targetType: "place", status: { in: ["PENDING", "REVIEWING"] } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.targetId, g._count._all]));
}

/** How many spots sit in each review state, and how many need a look. */
export async function placeAdminCounts() {
  const reportedIds = [...(await openPlaceReports()).keys()];
  const [byStatus, reported, notOpen, attention] = await Promise.all([
    db.place.groupBy({
      by: ["reviewStatus"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    openPlaceReports(),
    db.place.count({
      where: {
        deletedAt: null,
        reviewStatus: "APPROVED",
        operatingStatus: { not: "OPEN" },
      },
    }),
    // "Cần xem lại": public spots a customer reported or that are closed.
    db.place.count({
      where: {
        deletedAt: null,
        reviewStatus: "APPROVED",
        OR: [{ id: { in: reportedIds } }, { operatingStatus: { not: "OPEN" } }],
      },
    }),
  ]);
  const count = new Map(byStatus.map((g) => [g.reviewStatus, g._count._all]));
  return {
    PENDING: count.get("PENDING") ?? 0,
    APPROVED: count.get("APPROVED") ?? 0,
    REJECTED: count.get("REJECTED") ?? 0,
    reported: reported.size,
    notOpen,
    attention,
  };
}

export async function getPlaceForAdmin(placeId: string) {
  const place = await db.place.findFirst({
    where: { id: placeId, deletedAt: null },
    include: {
      province: { select: { id: true, code: true, name: true } },
      ward: { select: { id: true, name: true } },
      submittedBy: {
        select: { id: true, name: true, email: true, username: true },
      },
      media: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
      },
      _count: { select: { albums: { where: { deletedAt: null } } } },
    },
  });
  if (!place) return null;
  const [nearby, reports] = await Promise.all([
    nearbyPlaces(place, place.id),
    db.report.findMany({
      where: {
        targetType: "place",
        targetId: place.id,
        status: { in: ["PENDING", "REVIEWING"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, reason: true, description: true, createdAt: true },
    }),
  ]);
  return { place, nearby, reports, href: placeHref(place) };
}

/**
 * Approve or send back a waiting spot. Approving also approves its photos
 * that are still waiting (an admin rejects a bad photo first, one by one);
 * at least one photo must survive, since a spot's page leads with it.
 */
export async function reviewPlace({
  placeId,
  adminId,
  action,
  reason,
}: {
  placeId: string;
  adminId: string;
  action: "approve" | "reject";
  reason?: string;
}) {
  const now = new Date();
  const reviewed = await db.$transaction(async (tx) => {
    const place = await tx.place.findFirst({
      where: { id: placeId, deletedAt: null },
      include: {
        media: {
          where: { deletedAt: null, moderationStatus: { not: "REJECTED" } },
          orderBy: { order: "asc" },
          select: { id: true },
        },
      },
    });
    if (!place) throw new PlaceError("not_found", 404);
    if (action === "approve" && place.media.length === 0) {
      throw new PlaceError("no_photo");
    }
    const update = await tx.place.updateMany({
      where: { id: placeId, reviewStatus: "PENDING" },
      data:
        action === "approve"
          ? {
              reviewStatus: "APPROVED",
              moderationNote: null,
              moderatedBy: adminId,
              moderatedAt: now,
              lastVerifiedAt: now,
              coverMediaId: place.coverMediaId ?? place.media[0].id,
            }
          : {
              reviewStatus: "REJECTED",
              moderationNote: reason ?? null,
              moderatedBy: adminId,
              moderatedAt: now,
            },
    });
    if (update.count !== 1) throw new PlaceError("already_reviewed", 409);
    if (action === "approve") {
      await tx.placeMedia.updateMany({
        where: { placeId, deletedAt: null, moderationStatus: "PENDING" },
        data: {
          moderationStatus: "APPROVED",
          moderatedBy: adminId,
          moderatedAt: now,
        },
      });
    }
    return tx.place.findUniqueOrThrow({
      where: { id: placeId },
      include: { province: { select: { code: true } } },
    });
  });

  // Tell the proposer — not an admin reviewing their own entry.
  if (reviewed.submittedById && reviewed.submittedById !== adminId) {
    await notifyProposer(reviewed, action);
  }
  return reviewed;
}

async function notifyProposer(
  place: {
    id: string;
    name: string;
    slug: string;
    submittedById: string | null;
    moderationNote: string | null;
    province: { code: string };
  },
  action: "approve" | "reject",
) {
  if (!place.submittedById) return;
  try {
    // The proposer did not trigger this, so their language is Vietnamese
    // rather than the reviewing admin's (as reviewServiceRequest does).
    const nt = await getTranslations({
      locale: "vi",
      namespace: "libServices.notifications.place",
    });
    const reason =
      place.moderationNote?.trim().replace(/[.!?…\s]+$/u, "") || undefined;
    await notify({
      userId: place.submittedById,
      type: action === "approve" ? "PLACE_APPROVED" : "PLACE_REJECTED",
      title: nt(action === "approve" ? "approved.title" : "rejected.title"),
      message:
        action === "approve"
          ? nt("approved.message", { name: place.name })
          : reason
            ? nt("rejected.messageWithReason", { name: place.name, reason })
            : nt("rejected.message", { name: place.name }),
      data: {
        placeId: place.id,
        href:
          action === "approve"
            ? `/dashboard/places?approved=${place.id}`
            : `/dashboard/places/${place.id}`,
      },
    });
  } catch (error) {
    // The decision is committed; a failed notice must not undo it.
    console.error("[Places] Review notification failed", {
      placeId: place.id,
      action,
      error,
    });
  }
}

/** An admin adds a spot directly — for the starter set. */
export async function adminCreatePlace(
  adminId: string,
  input: PlaceFieldsInput & { photos: PlacePhotoInput[] },
) {
  await checkArea(input);
  await verifyPhotos(adminId, input.photos);
  const now = new Date();
  return db.$transaction(async (tx) => {
    const place = await tx.place.create({
      data: {
        ...(factsData(input) as Prisma.PlaceUncheckedCreateInput),
        slug: await freeSlug(tx, input.provinceId, input.name),
        submittedById: adminId,
      },
    });
    if (input.photos.length > 0) {
      await tx.placeMedia.createMany({
        data: input.photos.map((photo, index) => ({
          placeId: place.id,
          uploaderId: adminId,
          url: photo.url,
          publicId: photo.publicId,
          width: photo.width ?? null,
          height: photo.height ?? null,
          caption: photo.caption ?? null,
          order: index,
          rightsConfirmedAt: now,
        })),
      });
    }
    return place;
  });
}

export async function adminUpdatePlace(
  placeId: string,
  input: AdminPlaceUpdateInput,
) {
  const place = await db.place.findFirst({
    where: { id: placeId, deletedAt: null },
  });
  if (!place) throw new PlaceError("not_found", 404);
  const provinceId = input.provinceId ?? place.provinceId;
  if (input.provinceId !== undefined || input.wardId !== undefined) {
    await checkArea({
      provinceId,
      wardId: input.wardId === undefined ? place.wardId : input.wardId,
    });
  }
  const name = input.name ?? place.name;
  // A public spot keeps its address when renamed: links people shared and
  // search results point at it. Moving it to another province has to change
  // the address (the province is part of it).
  const reslug =
    provinceId !== place.provinceId ||
    (name !== place.name && place.reviewStatus !== "APPROVED");
  return db.$transaction(async (tx) => {
    const { markVerified, operatingStatus, statusNote, ...facts } = input;
    return tx.place.update({
      where: { id: placeId },
      data: {
        ...factsData(facts),
        ...(operatingStatus ? { operatingStatus } : {}),
        ...(statusNote !== undefined ? { statusNote } : {}),
        ...(markVerified ? { lastVerifiedAt: new Date() } : {}),
        slug: reslug
          ? await freeSlug(tx, provinceId, name, placeId)
          : undefined,
      },
    });
  });
}

export async function moderatePlaceMedia({
  placeId,
  adminId,
  mediaIds,
  action,
  note,
}: {
  placeId: string;
  adminId: string;
  mediaIds: string[];
  action: "approve" | "reject";
  note?: string;
}) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.placeMedia.updateMany({
      where: { placeId, id: { in: mediaIds }, deletedAt: null },
      data: {
        moderationStatus: action === "approve" ? "APPROVED" : "REJECTED",
        moderationNote: action === "reject" ? (note ?? null) : null,
        moderatedBy: adminId,
        moderatedAt: now,
      },
    });
    // A rejected cover must not stay the cover: fall back to the first
    // approved photo, or none.
    const place = await tx.place.findUniqueOrThrow({
      where: { id: placeId },
      select: { coverMediaId: true },
    });
    if (place.coverMediaId && mediaIds.includes(place.coverMediaId)) {
      if (action === "reject") {
        const next = await tx.placeMedia.findFirst({
          where: { placeId, ...APPROVED_PHOTO },
          orderBy: { order: "asc" },
          select: { id: true },
        });
        await tx.place.update({
          where: { id: placeId },
          data: { coverMediaId: next?.id ?? null },
        });
      }
    }
  });
}

export async function setPlaceCover(placeId: string, mediaId: string) {
  const media = await db.placeMedia.findFirst({
    where: { id: mediaId, placeId, ...APPROVED_PHOTO },
    select: { id: true },
  });
  if (!media) throw new PlaceError("not_found", 404);
  await db.place.update({
    where: { id: placeId },
    data: { coverMediaId: media.id },
  });
}

/** An admin adds photos; theirs are approved as they go in. */
export async function adminAddPlacePhotos(
  placeId: string,
  adminId: string,
  photos: PlacePhotoInput[],
) {
  const place = await db.place.findFirst({
    where: { id: placeId, deletedAt: null },
    select: { id: true, coverMediaId: true },
  });
  if (!place) throw new PlaceError("not_found", 404);
  await verifyPhotos(adminId, photos);
  const last = await db.placeMedia.aggregate({
    where: { placeId },
    _max: { order: true },
  });
  const now = new Date();
  await db.placeMedia.createMany({
    data: photos.map((photo, index) => ({
      placeId,
      uploaderId: adminId,
      url: photo.url,
      publicId: photo.publicId,
      width: photo.width ?? null,
      height: photo.height ?? null,
      caption: photo.caption ?? null,
      order: (last._max.order ?? -1) + 1 + index,
      rightsConfirmedAt: now,
      moderationStatus: "APPROVED",
      moderatedBy: adminId,
      moderatedAt: now,
    })),
  });
  if (!place.coverMediaId) {
    const first = await db.placeMedia.findFirst({
      where: { placeId, ...APPROVED_PHOTO },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    if (first) {
      await db.place.update({
        where: { id: placeId },
        data: { coverMediaId: first.id },
      });
    }
  }
}

/**
 * Fold a duplicate into the spot it duplicates: its albums and photos move
 * across, and its address redirects there.
 */
export async function mergePlaces(fromId: string, intoId: string) {
  if (fromId === intoId) throw new PlaceError("merge_self");
  await db.$transaction(async (tx) => {
    const [from, into] = await Promise.all([
      tx.place.findFirst({ where: { id: fromId, deletedAt: null } }),
      tx.place.findFirst({
        where: { id: intoId, deletedAt: null, mergedIntoId: null },
      }),
    ]);
    if (!from || !into) throw new PlaceError("not_found", 404);
    await tx.album.updateMany({
      where: { placeId: fromId },
      data: { placeId: intoId },
    });
    const last = await tx.placeMedia.aggregate({
      where: { placeId: intoId },
      _max: { order: true },
    });
    const moving = await tx.placeMedia.findMany({
      where: { placeId: fromId, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    for (const [index, media] of moving.entries()) {
      await tx.placeMedia.update({
        where: { id: media.id },
        data: { placeId: intoId, order: (last._max.order ?? -1) + 1 + index },
      });
    }
    await tx.place.update({
      where: { id: fromId },
      data: { mergedIntoId: intoId, deletedAt: new Date(), coverMediaId: null },
    });
  });
}

export async function deletePlace(placeId: string) {
  const result = await db.place.updateMany({
    where: { id: placeId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count !== 1) throw new PlaceError("not_found", 404);
  // Albums keep their photos; they just stop pointing at a spot that is gone.
  await db.album.updateMany({
    where: { placeId },
    data: { placeId: null },
  });
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

async function placeIdsMatching(
  q: string,
  { includeUnapproved = false } = {},
): Promise<string[]> {
  const pattern = `%${escapeLike(foldVietnamese(q))}%`;
  const rows = includeUnapproved
    ? await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM places
        WHERE "deletedAt" IS NULL
          AND lower(translate(name, ${SQL_FOLD_FROM}, ${SQL_FOLD_TO})) LIKE ${pattern}
        LIMIT 200
      `
    : await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM places
        WHERE "deletedAt" IS NULL
          AND "mergedIntoId" IS NULL
          AND "reviewStatus" = 'APPROVED'
          AND lower(translate(name, ${SQL_FOLD_FROM}, ${SQL_FOLD_TO})) LIKE ${pattern}
        LIMIT 200
      `;
  return rows.map((row) => row.id);
}

/** "Chụp tại" picker on an album: approved spots by name, accent-blind. */
export async function searchApprovedPlaces(q: string, limit = 8) {
  const ids = await placeIdsMatching(q);
  if (ids.length === 0) return [];
  const rows = await db.place.findMany({
    where: { id: { in: ids }, ...PUBLIC_PLACE },
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      province: { select: { code: true, name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    provinceName: row.province.name,
    href: placeHref(row),
  }));
}

/** Whether any spot is public yet — the Fmap layer and links wait for it. */
export async function hasPublicPlaces() {
  return (await db.place.count({ where: PUBLIC_PLACE, take: 1 })) > 0;
}

function coverOf(place: {
  coverMedia: {
    url: string;
    moderationStatus: ModerationStatus;
    deletedAt: Date | null;
  } | null;
  media: { url: string }[];
}) {
  return place.coverMedia &&
    place.coverMedia.moderationStatus === "APPROVED" &&
    !place.coverMedia.deletedAt
    ? place.coverMedia.url
    : (place.media[0]?.url ?? null);
}

const CARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  kind: true,
  categories: true,
  bestMonths: true,
  operatingStatus: true,
  latitude: true,
  longitude: true,
  province: { select: { code: true, name: true } },
  ward: { select: { name: true } },
  coverMedia: {
    select: { url: true, moderationStatus: true, deletedAt: true },
  },
  media: {
    where: APPROVED_PHOTO,
    orderBy: { order: "asc" },
    take: 1,
    select: { url: true },
  },
  _count: {
    select: {
      albums: {
        where: {
          deletedAt: null,
          isPublished: true,
          media: { some: APPROVED_ALBUM_IMAGE },
          profile: { isPublished: true, user: PUBLIC_USER_FILTER },
        },
      },
    },
  },
} as const satisfies Prisma.PlaceSelect;

type CardRow = Prisma.PlaceGetPayload<{ select: typeof CARD_SELECT }>;

function toCard(row: CardRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    categories: row.categories,
    bestMonths: row.bestMonths,
    operatingStatus: row.operatingStatus,
    latitude: row.latitude,
    longitude: row.longitude,
    provinceName: row.province.name,
    wardName: row.ward?.name ?? null,
    coverUrl: coverOf(row),
    albumCount: row._count.albums,
    href: placeHref(row),
  };
}

export type PlaceCard = ReturnType<typeof toCard>;

export async function listPublicPlaces({
  provinceCode,
  kind,
  category,
  page = 1,
  limit = 24,
}: {
  provinceCode?: string;
  kind?: PlaceKind;
  category?: ProfileCategory;
  page?: number;
  limit?: number;
}) {
  const where: Prisma.PlaceWhereInput = {
    ...PUBLIC_PLACE,
    ...(provinceCode ? { province: { code: provinceCode } } : {}),
    ...(kind ? { kind } : {}),
    ...(category ? { categories: { has: category } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.place.count({ where }),
    db.place.findMany({
      where,
      orderBy: [
        { lastVerifiedAt: { sort: "desc", nulls: "last" } },
        { name: "asc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
      select: CARD_SELECT,
    }),
  ]);
  return {
    data: rows.map(toCard),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Kinds that have at least one public spot (in a province, if given). */
export async function placeKindsInUse(provinceCode?: string) {
  const groups = await db.place.groupBy({
    by: ["kind"],
    where: {
      ...PUBLIC_PLACE,
      ...(provinceCode ? { province: { code: provinceCode } } : {}),
    },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.kind, g._count._all]));
}

/** Provinces that have at least one public spot, with how many. */
export async function placeProvinces() {
  const groups = await db.place.groupBy({
    by: ["provinceId"],
    where: PUBLIC_PLACE,
    _count: { _all: true },
  });
  if (groups.length === 0) return [];
  const provinces = await db.province.findMany({
    where: { id: { in: groups.map((g) => g.provinceId) } },
    select: { id: true, code: true, name: true },
  });
  const count = new Map(groups.map((g) => [g.provinceId, g._count._all]));
  return provinces
    .map((p) => ({ code: p.code, name: p.name, count: count.get(p.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
}

/** Fmap's spot layer: public spots inside the visible map. */
export async function placesInBounds({
  north,
  south,
  east,
  west,
  kinds,
  categories,
}: {
  north: number;
  south: number;
  east: number;
  west: number;
  kinds: PlaceKind[];
  categories: ProfileCategory[];
}) {
  const rows = await db.place.findMany({
    where: {
      ...PUBLIC_PLACE,
      latitude: { gte: south, lte: north },
      longitude: { gte: west, lte: east },
      ...(kinds.length > 0 ? { kind: { in: kinds } } : {}),
      ...(categories.length > 0 ? { categories: { hasSome: categories } } : {}),
    },
    take: 300,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

/**
 * A spot's public page, or where it went (merged), or null. Approved only.
 */
export async function getPublicPlace(provinceCode: string, slug: string) {
  const place = await db.place.findFirst({
    where: { slug, province: { code: provinceCode } },
    include: {
      province: { select: { id: true, code: true, name: true } },
      ward: { select: { name: true } },
      mergedInto: {
        select: {
          slug: true,
          deletedAt: true,
          reviewStatus: true,
          province: { select: { code: true } },
        },
      },
      coverMedia: {
        select: {
          id: true,
          url: true,
          moderationStatus: true,
          deletedAt: true,
        },
      },
      media: {
        where: APPROVED_PHOTO,
        orderBy: { order: "asc" },
        select: {
          id: true,
          url: true,
          width: true,
          height: true,
          caption: true,
        },
      },
    },
  });
  if (!place) return null;
  if (place.mergedInto) {
    return place.mergedInto.reviewStatus === "APPROVED" &&
      !place.mergedInto.deletedAt
      ? { kind: "redirect" as const, href: placeHref(place.mergedInto) }
      : null;
  }
  if (place.deletedAt || place.reviewStatus !== "APPROVED") return null;

  // The cover leads; the rest follow in the order they were added.
  const coverId =
    place.coverMedia?.moderationStatus === "APPROVED" &&
    !place.coverMedia.deletedAt
      ? place.coverMedia.id
      : null;
  const photos = coverId
    ? [
        ...place.media.filter((m) => m.id === coverId),
        ...place.media.filter((m) => m.id !== coverId),
      ]
    : place.media;

  const [albums, nearbyProviders] = await Promise.all([
    albumsShotAt(place.id),
    providersNear(place),
  ]);

  return {
    kind: "place" as const,
    place: {
      id: place.id,
      name: place.name,
      slug: place.slug,
      description: place.description,
      kind: place.kind,
      categories: place.categories,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      provinceCode: place.province.code,
      provinceName: place.province.name,
      wardName: place.ward?.name ?? null,
      bestTimeNote: place.bestTimeNote,
      bestMonths: place.bestMonths,
      entryFeeVnd: place.entryFeeVnd,
      feeNote: place.feeNote,
      permitRequired: place.permitRequired,
      rulesNote: place.rulesNote,
      crowdNote: place.crowdNote,
      parkingNote: place.parkingNote,
      operatingStatus: place.operatingStatus,
      statusNote: place.statusNote,
      lastVerifiedAt: place.lastVerifiedAt,
      updatedAt: place.updatedAt,
      href: placeHref(place),
    },
    photos,
    albums,
    nearbyProviders,
  };
}

/** "Nhiếp ảnh gia đã chụp ở đây": public albums tagged with the spot. */
export async function albumsShotAt(placeId: string, limit = 12) {
  const where: Prisma.AlbumWhereInput = {
    placeId,
    deletedAt: null,
    isPublished: true,
    media: { some: APPROVED_ALBUM_IMAGE },
    profile: { isPublished: true, user: PUBLIC_USER_FILTER },
  };
  const [total, rows] = await Promise.all([
    db.album.count({ where }),
    db.album.findMany({
      where,
      orderBy: [
        { shootDate: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        category: true,
        coverMedia: {
          select: { url: true, moderationStatus: true, deletedAt: true },
        },
        media: {
          where: APPROVED_ALBUM_IMAGE,
          orderBy: { order: "asc" },
          take: 1,
          select: { url: true },
        },
        _count: { select: { media: { where: APPROVED_ALBUM_IMAGE } } },
        profile: {
          select: {
            role: true,
            displayName: true,
            priceMin: true,
            services: ACTIVE_SERVICE_PRICES,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
                acceptingBookings: true,
              },
            },
          },
        },
      },
    }),
  ]);
  return {
    total,
    data: rows.map((album) => ({
      id: album.id,
      title: album.title,
      category: album.category,
      coverUrl:
        album.coverMedia &&
        album.coverMedia.moderationStatus === "APPROVED" &&
        !album.coverMedia.deletedAt
          ? album.coverMedia.url
          : (album.media[0]?.url ?? null),
      photoCount: album._count.media,
      providerName: album.profile.displayName ?? album.profile.user.name ?? "",
      providerUsername: album.profile.user.username ?? "",
      providerAvatar: album.profile.user.image,
      providerRole: album.profile.role,
      startingPrice: startingPrice(album.profile),
      href: `/profile/${album.profile.user.username}/albums/${album.id}`,
      // Straight to booking or a chat from the spot's page — the point of
      // listing who shot here.
      bookingHref:
        PROVIDER_ROLES.includes(album.profile.role) &&
        album.profile.user.acceptingBookings
          ? `/booking/${album.profile.user.id}`
          : null,
      messageHref: `/dashboard/messages?to=${album.profile.user.id}&consult=1`,
    })),
  };
}

/**
 * Providers based near the spot. Only names and links: the distance to a
 * provider's private base is never shown (services/fmap.ts blurs it).
 */
async function providersNear(point: { latitude: number; longitude: number }) {
  const box = boxAround(point, NEARBY_PROVIDER_RADIUS_KM * 1000);
  const rows = await db.profile.findMany({
    where: {
      isPublished: true,
      role: { in: PROVIDER_ROLES },
      user: PUBLIC_USER_FILTER,
      latitude: { gte: box.south, lte: box.north },
      longitude: { gte: box.west, lte: box.east },
    },
    take: 30,
    select: {
      id: true,
      role: true,
      displayName: true,
      latitude: true,
      longitude: true,
      priceMin: true,
      services: ACTIVE_SERVICE_PRICES,
      user: { select: { name: true, username: true, image: true } },
    },
  });
  return rows
    .map((row) => ({
      row,
      distance: distanceMeters(point, {
        latitude: row.latitude ?? point.latitude,
        longitude: row.longitude ?? point.longitude,
      }),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6)
    .map(({ row }) => ({
      profileId: row.id,
      role: row.role,
      name: row.displayName ?? row.user.name ?? "",
      username: row.user.username ?? "",
      avatar: row.user.image,
      startingPrice: startingPrice(row),
    }));
}

/** Sitemap: every public spot. */
export async function placesForSitemap() {
  const rows = await db.place.findMany({
    where: PUBLIC_PLACE,
    select: {
      slug: true,
      updatedAt: true,
      province: { select: { code: true } },
    },
  });
  return rows.map((row) => ({
    href: placeHref(row),
    updatedAt: row.updatedAt,
  }));
}
