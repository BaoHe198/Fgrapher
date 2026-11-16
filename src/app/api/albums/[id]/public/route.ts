import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { findPublicAlbum } from "@/services/public-profile";

// The photos of one public album, for the quick-view lightbox on Cộng đồng F
// and Tìm kiếm F (owner, 16/11/2026: pressing an album opens the photos in
// place instead of leaving the page). No auth: it serves exactly what the
// public album page already shows — a published album of a published
// profile, approved photos only — through the same cached loader.

const querySchema = z.object({
  username: z.string().trim().min(1).max(64),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.albums");
  try {
    const { id } = await params;
    const parsed = querySchema.safeParse({
      username: new URL(request.url).searchParams.get("username"),
    });
    if (!parsed.success || id.length > 64) {
      return NextResponse.json(
        { data: null, error: "invalid_request", message: t("notFound") },
        { status: 400 },
      );
    }

    const found = await findPublicAlbum(parsed.data.username, id);
    if (!found) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("notFound") },
        { status: 404 },
      );
    }

    const { user, profile, album, photos, bookingHref } = found;
    return NextResponse.json(
      {
        data: {
          id: album.id,
          title: album.title,
          description: album.description,
          category: album.category,
          artist: {
            name: profile.displayName ?? user.name ?? parsed.data.username,
            href: `/profile/${parsed.data.username}`,
            bookingHref,
          },
          photos: photos.map((media) => ({
            id: media.id,
            url: media.url,
            type: media.type,
            title: media.title,
          })),
        },
        error: null,
        message: null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}
