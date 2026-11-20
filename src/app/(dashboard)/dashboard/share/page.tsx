import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PROVIDER_ROLES } from "@/lib/constants";
import { formatAdministrativeLocation, shortPlace } from "@/lib/location";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { getProfileReviewStats } from "@/services/public-profile";
import { listWeeklyRules } from "@/services/resource-calendar";

import { ShareClient, type ReadinessItem } from "./share-client";

// "Link & mã QR" (owner, 17/11/2026): the provider's own link and QR code
// to put on TikTok, Facebook, Instagram and Zalo, so the customers they
// already find there land on a page that can take the booking. The research
// behind it found customers discover providers on social feeds and close in
// chat; this page goes where they already are instead of competing with it.
export default async function SharePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.roles.some((role) => PROVIDER_ROLES.includes(role))) {
    redirect("/dashboard");
  }
  const userId = session.user.id;

  const [t, roleT, user, profile] = await Promise.all([
    getTranslations("dashboardCore.share"),
    getTranslations("role"),
    db.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        name: true,
        firstName: true,
        coverImage: true,
        ward: { select: { name: true, province: { select: { name: true } } } },
      },
    }),
    db.profile.findFirst({
      where: { userId, role: { in: PROVIDER_ROLES } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        displayName: true,
        isPublished: true,
        depositPercent: true,
        depositPolicy: true,
        cancellationPolicy: true,
        provinceId: true,
        wardId: true,
        province: { select: { name: true } },
        ward: { select: { name: true } },
        services: { where: { isActive: true }, select: { price: true } },
      },
    }),
  ]);
  if (!user || !profile) redirect("/dashboard");

  const [roleRecord, approvedPhotos, weeklyRules, reviewStats, firstPhoto] =
    await Promise.all([
      db.userRole.findFirst({
        where: { userId, role: profile.role },
        select: { verificationStatus: true },
      }),
      db.profileMedia.count({
        where: {
          profileId: profile.id,
          moderationStatus: "APPROVED",
          deletedAt: null,
        },
      }),
      listWeeklyRules(userId),
      getProfileReviewStats(userId),
      // Without a cover, the link page and its chat preview fall back to the
      // first approved photo; the preview here shows the same one.
      db.profileMedia.findFirst({
        where: {
          profileId: profile.id,
          type: "IMAGE",
          moderationStatus: "APPROVED",
          deletedAt: null,
          album: { isPublished: true, deletedAt: null },
        },
        orderBy: { order: "asc" },
        select: { url: true },
      }),
    ]);

  const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const username = user.username;
  const displayName = profile.displayName ?? user.name ?? username ?? "";
  const place = formatAdministrativeLocation(
    profile,
    profile.wardId || profile.provinceId ? undefined : { ward: user.ward },
  );
  const paidPrices = profile.services.map((s) => s.price).filter((p) => p > 0);
  const priceFrom = paidPrices.length > 0 ? Math.min(...paidPrices) : null;
  const isVerified = roleRecord?.verificationStatus === "VERIFIED";

  // Each line is something a customer arriving from the link would miss,
  // with the place to fix it. Ordered by how much it costs a booking.
  const readiness: ReadinessItem[] = [
    {
      key: "published",
      done: profile.isPublished,
      href: "/dashboard",
    },
    {
      key: "verified",
      done: isVerified,
      href: "/dashboard/settings/roles",
    },
    {
      key: "prices",
      done: paidPrices.length > 0,
      href: "/dashboard/services",
    },
    {
      key: "hours",
      done: weeklyRules.length > 0,
      href: "/dashboard/calendar?hours=1",
    },
    {
      key: "policies",
      done:
        (profile.depositPercent != null || Boolean(profile.depositPolicy)) &&
        Boolean(profile.cancellationPolicy),
      href: "/dashboard/my-page/info#chinh-sach",
    },
    {
      key: "photos",
      done: approvedPhotos >= 6,
      href: "/dashboard/portfolio",
    },
    {
      key: "cover",
      done: Boolean(user.coverImage),
      href: "/dashboard/my-page/info#anh",
    },
  ];

  const previewFacts = [
    priceFrom ? t("preview.from", { price: formatCurrency(priceFrom) }) : null,
    reviewStats.count > 0
      ? t("preview.rating", {
          rating: reviewStats.avgRating.toFixed(1).replace(".", ","),
          count: reviewStats.count,
        })
      : null,
    isVerified ? t("preview.verified") : null,
    place ? shortPlace(place) : null,
  ].filter(Boolean) as string[];

  return (
    <ShareClient
      link={username ? `${baseUrl}/p/${username}` : null}
      pagePath={username ? `/p/${username}` : null}
      host={baseUrl.replace(/^https?:\/\//, "")}
      displayName={displayName}
      roleLabel={roleT(profile.role)}
      place={place ? shortPlace(place) : null}
      coverImage={user.coverImage ?? firstPhoto?.url ?? null}
      previewFacts={previewFacts}
      readiness={readiness}
    />
  );
}
