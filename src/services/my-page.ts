import type { Role } from "@prisma/client";

import { PAID_ROLES, PROVIDER_ROLES, SHOP_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";

/**
 * "Trang của tôi": everything a customer sees of this provider, one card per
 * part, each saying whether it is done and what is missing. It replaces two
 * different "what to set up" lists (the overview's and the share page's)
 * that pointed into a long Settings form.
 *
 * The publish blockers mirror setProfilePublished() in public-profile.ts —
 * keep the two in step. This only explains; it never publishes.
 */
export type CardState = "done" | "todo" | "waiting" | "info";

export interface MyPageCard {
  key:
    | "verify"
    | "portfolio"
    | "services"
    | "info"
    | "costumes"
    | "area"
    | "policies"
    | "hours"
    | "reviews"
    | "share";
  state: CardState;
  href: string;
  /** Values for the card's status sentence. */
  values: Record<string, string | number>;
  /** Which sentence to show, under dashboardCore.myPage.cards.<key>. */
  detail: string;
}

export type PublishBlocker =
  "verify" | "photo" | "costumePhoto" | "categories" | "address";

export interface MyPageStatus {
  role: Role;
  displayName: string | null;
  username: string | null;
  published: boolean;
  blockers: PublishBlocker[];
  cards: MyPageCard[];
}

export async function getMyPageStatus(
  userId: string,
): Promise<MyPageStatus | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      avatar: true,
      coverImage: true,
      roles: {
        where: { role: { in: PAID_ROLES }, active: true },
        select: { role: true, verificationStatus: true },
      },
    },
  });
  // One provider identity per account (MVP, see CLAUDE.md).
  const userRole = user?.roles[0];
  if (!user || !userRole) return null;
  const role = userRole.role;
  const isProvider = PROVIDER_ROLES.includes(role);

  const profile = await db.profile.findUnique({
    where: { userId_role: { userId, role } },
    select: {
      id: true,
      displayName: true,
      description: true,
      categories: true,
      address: true,
      provinceId: true,
      wardId: true,
      geocodingStatus: true,
      latitude: true,
      longitude: true,
      depositPolicy: true,
      depositPercent: true,
      cancellationPolicy: true,
      isPublished: true,
      _count: {
        select: {
          services: { where: { isActive: true } },
          costumes: true,
          albums: { where: { deletedAt: null } },
        },
      },
      resources: {
        select: {
          _count: { select: { rules: { where: { isActive: true } } } },
        },
      },
    },
  });

  const [approvedPhotos, pendingPhotos, reviews] = profile
    ? await Promise.all([
        db.profileMedia.count({
          where: {
            profileId: profile.id,
            deletedAt: null,
            moderationStatus: "APPROVED",
          },
        }),
        db.profileMedia.count({
          where: {
            profileId: profile.id,
            deletedAt: null,
            moderationStatus: "PENDING",
          },
        }),
        db.review.aggregate({
          where: { reviewedId: userId },
          _count: true,
          _avg: { rating: true },
        }),
      ])
    : [0, 0, null];

  const verified = userRole.verificationStatus === "VERIFIED";
  const hasAddress = Boolean(
    profile?.address?.trim() && profile.provinceId && profile.wardId,
  );
  const onMap =
    profile?.geocodingStatus === "READY" &&
    profile.latitude != null &&
    profile.longitude != null;
  const hasHours = Boolean(
    profile?.resources.some((resource) => resource._count.rules > 0),
  );
  const isShop = SHOP_ROLES.includes(role);

  const blockers: PublishBlocker[] = [];
  if (!verified) blockers.push("verify");
  // A costume shop's outfit photos are its portfolio (ProfileMedia), so it
  // has the same rule under its own words.
  if (role !== "CAMERA_SHOP" && approvedPhotos === 0) {
    blockers.push(role === "COSTUME_SHOP" ? "costumePhoto" : "photo");
  }
  if (!isShop && !profile?.categories.length) blockers.push("categories");
  if (!hasAddress) blockers.push("address");

  const missingInfo = [
    !profile?.displayName?.trim() ? "displayName" : null,
    !user.avatar ? "avatar" : null,
    !user.coverImage ? "cover" : null,
    !isShop && !profile?.categories.length ? "categories" : null,
    !profile?.description?.trim() ? "description" : null,
  ].filter((item): item is string => item !== null);

  const cards: MyPageCard[] = [
    {
      key: "verify",
      state: verified
        ? "done"
        : userRole.verificationStatus === "PENDING"
          ? "waiting"
          : "todo",
      href: verified
        ? "/dashboard/settings/roles"
        : `/onboarding/verification?role=${role}`,
      values: {},
      detail: userRole.verificationStatus.toLowerCase(),
    },
  ];

  if (isProvider) {
    cards.push({
      key: "portfolio",
      state:
        approvedPhotos > 0 ? "done" : pendingPhotos > 0 ? "waiting" : "todo",
      href: "/dashboard/portfolio",
      values: { approved: approvedPhotos, pending: pendingPhotos },
      detail:
        approvedPhotos > 0
          ? pendingPhotos > 0
            ? "someWaiting"
            : "ready"
          : pendingPhotos > 0
            ? "allWaiting"
            : "empty",
    });
    cards.push({
      key: "services",
      state: (profile?._count.services ?? 0) > 0 ? "done" : "todo",
      href: "/dashboard/services",
      values: { count: profile?._count.services ?? 0 },
      detail: (profile?._count.services ?? 0) > 0 ? "count" : "empty",
    });
  }

  cards.push({
    key: "info",
    state: missingInfo.length === 0 ? "done" : "todo",
    href: "/dashboard/my-page/info",
    values: { missing: missingInfo.length },
    detail: missingInfo.length === 0 ? "complete" : missingInfo[0],
  });

  if (role === "COSTUME_SHOP") {
    cards.push({
      key: "costumes",
      state: (profile?._count.costumes ?? 0) > 0 ? "done" : "todo",
      href: "/dashboard/my-page/info#costumes",
      values: { count: profile?._count.costumes ?? 0 },
      detail: (profile?._count.costumes ?? 0) > 0 ? "count" : "empty",
    });
  }

  cards.push({
    key: "area",
    state: !hasAddress ? "todo" : isProvider && !onMap ? "waiting" : "done",
    href: "/dashboard/my-page/info#khu-vuc",
    values: {},
    detail: !hasAddress
      ? "missing"
      : isProvider && !onMap
        ? "notOnMap"
        : "ready",
  });

  if (isProvider) {
    const hasPolicies = Boolean(
      (profile?.depositPolicy || profile?.depositPercent != null) &&
      profile?.cancellationPolicy,
    );
    cards.push({
      key: "policies",
      state: hasPolicies ? "done" : "todo",
      href: "/dashboard/my-page/info#chinh-sach",
      values: {},
      detail: hasPolicies ? "ready" : "missing",
    });
    cards.push({
      key: "hours",
      state: hasHours ? "done" : "todo",
      href: "/dashboard/calendar?hours=1",
      values: {},
      detail: hasHours ? "ready" : "missing",
    });
    cards.push({
      key: "reviews",
      state: "info",
      href: "/dashboard/reviews",
      values: {
        count: reviews?._count ?? 0,
        average: reviews?._avg.rating
          ? reviews._avg.rating.toFixed(1).replace(".", ",")
          : "0",
      },
      detail: (reviews?._count ?? 0) > 0 ? "count" : "empty",
    });
    cards.push({
      key: "share",
      state: "info",
      href: "/dashboard/share",
      values: {},
      detail: "ready",
    });
  }

  return {
    role,
    displayName: profile?.displayName ?? null,
    username: user.username,
    published: Boolean(profile?.isPublished),
    blockers,
    cards,
  };
}
