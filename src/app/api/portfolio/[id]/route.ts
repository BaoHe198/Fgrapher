import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { deleteCloudinaryAsset, isCloudinaryConfigured } from "@/lib/cloudinary";
import { db } from "@/lib/db";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const media = await db.profileMedia.findUnique({
      where: { id },
      include: { profile: { select: { userId: true } } },
    });

    if (!media || media.profile.userId !== session.user.id) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Media not found" },
        { status: 404 },
      );
    }

    if (media.publicId && isCloudinaryConfigured()) {
      await deleteCloudinaryAsset(media.publicId, media.type === "VIDEO" ? "video" : "image");
    }

    await db.profileMedia.delete({ where: { id } });

    return NextResponse.json(
      { data: null, error: null, message: "Media deleted" },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to delete media" },
      { status: 500 },
    );
  }
}
