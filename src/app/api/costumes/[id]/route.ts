import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { revalidatePublicProfile } from "@/lib/cache";
import { db } from "@/lib/db";
import { updateCostumeSchema } from "@/lib/validations/costume";
import {
  findOwnedCostume,
  setCostumeGallery,
  softDeleteCostume,
} from "@/services/costumes";
import { ownPhotoIds } from "@/services/own-media";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const owned = await findOwnedCostume(id, session.user.id);
    if (!owned) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Outfit not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsed = updateCostumeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }

    const { galleryMediaIds, ...data } = parsed.data;
    const photoIds = [data.mediaId, ...(galleryMediaIds ?? [])].filter(
      (photoId): photoId is string => Boolean(photoId),
    );
    const own = await ownPhotoIds(owned.profileId, photoIds);
    if (photoIds.some((photoId) => !own.has(photoId))) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Photo not found" },
        { status: 404 },
      );
    }

    const item = await db.$transaction(async (tx) => {
      const updated = await tx.costumeItem.update({ where: { id }, data });
      // Left out of the request, the further photos stay as they are.
      if (galleryMediaIds !== undefined) {
        await setCostumeGallery(
          tx,
          id,
          owned.profileId,
          galleryMediaIds.filter((photoId) => photoId !== updated.mediaId),
        );
      }
      return updated;
    });

    await revalidatePublicProfile(session.user.id);

    return NextResponse.json(
      { data: item, error: null, message: "Outfit updated" },
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
      { data: null, error: "server_error", message: "Failed to update outfit" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const owned = await findOwnedCostume(id, session.user.id);
    if (!owned) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Outfit not found" },
        { status: 404 },
      );
    }

    await softDeleteCostume(id);
    await revalidatePublicProfile(session.user.id);

    return NextResponse.json(
      { data: null, error: null, message: "Outfit removed" },
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
      { data: null, error: "server_error", message: "Failed to remove outfit" },
      { status: 500 },
    );
  }
}
