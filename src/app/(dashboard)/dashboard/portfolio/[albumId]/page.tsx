import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAlbumWithMedia } from "@/services/albums";

import { AlbumDetail } from "./album-detail";

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const t = await getTranslations("dashboardCore.albums.detail");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { albumId } = await params;
  const album = await getAlbumWithMedia(albumId);
  if (!album) notFound();

  const profile = await db.profile.findUnique({
    where: { id: album.profileId },
  });
  if (!profile || profile.userId !== session.user.id) notFound();

  return (
    <AlbumDetail
      backLabel={t("back")}
      profileId={profile.id}
      role={profile.role}
      album={{
        id: album.id,
        title: album.title,
        description: album.description,
        category: album.category,
        shootDate: album.shootDate ? album.shootDate.toISOString() : null,
        coverMediaId: album.coverMediaId,
      }}
      initialMedia={album.media.map((m) => ({
        id: m.id,
        url: m.url,
        type: m.type,
        title: m.title,
        moderationStatus: m.moderationStatus,
        moderationNote: m.moderationNote,
      }))}
    />
  );
}
