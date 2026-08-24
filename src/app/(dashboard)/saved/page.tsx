import { Bookmark } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title="Saved artists" />

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Bookmark className="size-12 text-text-tertiary" />
          <p className="text-body-lg font-semibold text-text-primary">
            No saved artists yet
          </p>
          <p className="text-body-md text-text-secondary">
            Tap the bookmark icon on a profile to save it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ArtistCard
              key={profile.id}
              artist={{
                id: profile.id,
                name: profile.displayName ?? profile.user.name ?? "Unnamed",
                username: profile.user.username ?? "",
                roles: [ROLE_LABELS[profile.role]],
                city: profile.address ?? "",
                rating: "—",
                reviews: 0,
                price: profile.priceMin
                  ? `From ₫${profile.priceMin.toLocaleString()}`
                  : "",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
