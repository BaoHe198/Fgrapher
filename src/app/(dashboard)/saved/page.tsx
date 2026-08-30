import { Bookmark } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ArtistCard } from "@/components/cards/artist-card";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatVND } from "@/lib/format";

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
    where: { id: { in: saved.map((s) => s.profileId) } },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          firstName: true,
          lastName: true,
          avatar: true,
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
      <SectionHead title={t("title")} />

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Bookmark className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold! text-text-primary">
            {t("empty.title")}
          </p>
          <p className="text-body-md text-text-secondary">{t("empty.body")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const stats = statsByUser.get(profile.user.id) ?? {
              avg: 0,
              count: 0,
            };
            return (
              <ArtistCard
                key={profile.id}
                artist={{
                  id: profile.id,
                  name:
                    profile.displayName ?? profile.user.name ?? t("unnamed"),
                  username: profile.user.username ?? "",
                  roles: [roleT(profile.role)],
                  city: profile.address ?? "",
                  rating: stats.avg > 0 ? stats.avg.toFixed(1) : t("newBadge"),
                  reviews: stats.count,
                  price: profile.priceMin
                    ? t("priceFrom", { amount: formatVND(profile.priceMin) })
                    : "",
                  avatar: profile.user.avatar ?? undefined,
                  media: profile.media,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
