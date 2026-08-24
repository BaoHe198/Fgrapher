import { Bookmark } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ArtistCard } from "@/components/cards/artist-card";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";

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
        select: { username: true, name: true, firstName: true, lastName: true },
      },
    },
  });

  const t = await getTranslations("dashboardCore.saved");

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title={t("title")} />

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Bookmark className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">
            {t("empty.title")}
          </p>
          <p className="text-body-md text-text-secondary">{t("empty.body")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ArtistCard
              key={profile.id}
              artist={{
                id: profile.id,
                name: profile.displayName ?? profile.user.name ?? t("unnamed"),
                username: profile.user.username ?? "",
                roles: [ROLE_LABELS[profile.role]],
                city: profile.address ?? "",
                rating: "—",
                reviews: 0,
                price: profile.priceMin
                  ? t("priceFrom", {
                      amount: profile.priceMin.toLocaleString(),
                    })
                  : "",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
