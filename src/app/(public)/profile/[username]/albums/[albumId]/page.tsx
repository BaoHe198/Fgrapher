import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";

import { formatDate } from "@/lib/format";
import { formatAdministrativeLocation } from "@/lib/location";
import { videoPosterUrl } from "@/lib/media/video-link";
import { findPublicAlbum } from "@/services/public-profile";

import { AlbumEssay } from "./album-essay";

interface AlbumPageProps {
  params: Promise<{ username: string; albumId: string }>;
}

// The same cached, visitor-independent read the profile page uses: only a
// published album with approved photos of a published profile is found.
const loadAlbum = cache(findPublicAlbum);

export async function generateMetadata({
  params,
}: AlbumPageProps): Promise<Metadata> {
  const { username, albumId } = await params;
  const found = await loadAlbum(username, albumId);
  if (!found) return {};
  const { user, profile, album } = found;
  const name = profile.displayName ?? user.name ?? username;
  const t = await getTranslations("publicPages.album");
  const first = album.coverMedia?.url ?? album.media[0]?.url;
  // A share preview needs a picture: a video stands in as its poster frame.
  const image = first ? (videoPosterUrl(first) ?? first) : undefined;
  return {
    title: t("metaTitle", { title: album.title, name }),
    description: (album.description ?? t("metaDescription", { name })).slice(
      0,
      160,
    ),
    alternates: { canonical: `/profile/${username}/albums/${albumId}` },
    openGraph: { images: image ? [{ url: image }] : [] },
  };
}

// An album as a photo essay (wave 2, profile): title large,
// where/when/style, the artist's words, then the photos one after another
// at their own ratio.
export default async function AlbumPage({ params }: AlbumPageProps) {
  const { username, albumId } = await params;
  const found = await loadAlbum(username, albumId);
  if (!found) notFound();
  const { user, profile, album, photos, bookingHref } = found;
  const categoryT = await getTranslations("profileCategory");

  return (
    <AlbumEssay
      album={{
        id: album.id,
        title: album.title,
        description: album.description,
        meta: [
          formatAdministrativeLocation(profile) || null,
          album.shootDate ? formatDate(album.shootDate) : null,
          album.category ? categoryT(album.category) : null,
        ].filter((part): part is string => Boolean(part)),
        style: album.category ? categoryT(album.category) : null,
        place: album.place ?? null,
      }}
      photos={photos.map((media) => ({
        id: media.id,
        url: media.url,
        type: media.type,
        width: media.width,
        height: media.height,
        caption: media.title,
      }))}
      artist={{
        name: profile.displayName ?? user.name ?? username,
        href: `/profile/${username}`,
        bookingHref,
      }}
    />
  );
}
