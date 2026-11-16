import { Pin } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHead } from "@/components/ui/section-head";
import { auth } from "@/lib/auth";
import { getMoodboard, type MoodboardPhoto } from "@/services/moodboard";

import { MoodboardGroup } from "./moodboard-group";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboardCore.moodboard");
  return { title: t("title") };
}

// "Bảng ý tưởng" (owner, 16/11/2026): the photos a visitor pinned, grouped
// by the artist who took them, each group with one button that opens the
// chat with that artist and a drafted brief. Words are the hardest way to
// describe a style; a handful of the artist's own photos is the easiest.
export default async function MoodboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/moodboard");

  const [photos, t, roleT] = await Promise.all([
    getMoodboard(session.user.id),
    getTranslations("dashboardCore.moodboard"),
    getTranslations("role"),
  ]);

  // Group by artist, keeping the newest-pin-first order of the groups.
  const groups = new Map<string, MoodboardPhoto[]>();
  for (const photo of photos) {
    const group = groups.get(photo.artistId);
    if (group) group.push(photo);
    else groups.set(photo.artistId, [photo]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <SectionHead title={t("title")} as="h1" className="mb-0" />
        <p className="max-w-2xl text-body-md text-text-secondary">
          {t("intro")}
        </p>
      </div>

      {photos.length === 0 ? (
        <EmptyState
          icon={<Pin />}
          title={t("empty.title")}
          description={t("empty.body")}
          primaryAction={
            <Link
              href="/browse?view=photos"
              className={buttonVariants({ variant: "accent" })}
            >
              {t("empty.cta")}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          {Array.from(groups.entries()).map(([artistId, group]) => {
            const first = group[0];
            const name = first.artistName ?? t("unnamed");
            return (
              <MoodboardGroup
                key={artistId}
                artistId={artistId}
                isSelf={artistId === session.user.id}
                name={name}
                roleLabel={roleT(first.role)}
                profileHref={
                  first.artistUsername
                    ? `/profile/${first.artistUsername}`
                    : null
                }
                photos={group.map((photo) => ({
                  id: photo.id,
                  url: photo.url,
                  width: photo.width,
                  height: photo.height,
                  albumTitle: photo.albumTitle,
                }))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
