import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ArtistCard } from "@/components/cards/artist-card";
import { buttonVariants } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatVND } from "@/lib/format";
import { formatAdministrativeLocation } from "@/lib/location";

import { UnsaveButton } from "./unsave-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboardCore.saved");
  return { title: t("title") };
}

export default async function SavedProfilesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const saved = await db.savedProfile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const profiles = await db.profile.findMany({
    where: {
      id: { in: saved.map((s) => s.profileId) },
      isPublished: true,
      user: { deletedAt: null, isSuspended: false },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          firstName: true,
          lastName: true,
          avatar: true,
          ward: {
            select: {
              name: true,
              province: { select: { name: true } },
            },
          },
        },
      },
      province: { select: { name: true } },
      ward: {
        select: {
          name: true,
          province: { select: { name: true } },
        },
      },
      // Prompt G5 — the artist card's no-photo/carousel treatment needs
      // the same approved-media list every other ArtistCard caller
      // fetches (services/search.ts's PROVIDER_INCLUDE); this page never
      // went through search.ts, so it never had one.
      media: {
        where: { moderationStatus: "APPROVED" },
        orderBy: { order: "asc" },
        take: 5,
      },
    },
  });

  // Most recently saved first — the query above returns profiles in no
  // particular order.
  const savedOrder = new Map(saved.map((s, i) => [s.profileId, i]));
  profiles.sort(
    (a, b) => (savedOrder.get(a.id) ?? 0) - (savedOrder.get(b.id) ?? 0),
  );

  const t = await getTranslations("dashboardCore.saved");
  const roleT = await getTranslations("role");

  const userIds = Array.from(new Set(profiles.map((p) => p.user.id)));
  const reviewStats = userIds.length
    ? await db.review.groupBy({
        by: ["reviewedId"],
        where: { reviewedId: { in: userIds } },
        _avg: { rating: true },
        _count: { rating: true },
      })
    : [];
  const statsByUser = new Map(
    reviewStats.map((s) => [
      s.reviewedId,
      { avg: s._avg.rating ?? 0, count: s._count.rating },
    ]),
  );

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title={t("title")} as="h1" />

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Bookmark className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("empty.title")}
          </p>
          <p className="text-body-md text-text-secondary">{t("empty.body")}</p>
          <Link
            href="/browse"
            className={buttonVariants({ variant: "accent" })}
          >
            {t("empty.cta")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const stats = statsByUser.get(profile.user.id) ?? {
              avg: 0,
              count: 0,
            };
            return (
              <div key={profile.id} className="flex flex-col gap-1">
                <ArtistCard
                  artist={{
                    id: profile.id,
                    name:
                      profile.displayName ?? profile.user.name ?? t("unnamed"),
                    username: profile.user.username ?? "",
                    roles: [roleT(profile.role)],
                    city: formatAdministrativeLocation(
                      profile,
                      profile.wardId || profile.provinceId
                        ? undefined
                        : { ward: profile.user.ward },
                    ),
                    rating:
                      stats.avg > 0 ? stats.avg.toFixed(1) : t("newBadge"),
                    reviews: stats.count,
                    price: profile.priceMin
                      ? t("priceFrom", { amount: formatVND(profile.priceMin) })
                      : "",
                    avatar: profile.user.avatar ?? undefined,
                    media: profile.media,
                  }}
                />
                <UnsaveButton profileId={profile.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
