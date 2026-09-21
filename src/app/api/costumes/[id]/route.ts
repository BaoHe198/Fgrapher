import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { revalidatePublicProfile } from "@/lib/cache";
import { db } from "@/lib/db";
import { updateCostumeSchema } from "@/lib/validations/costume";
import { findOwnedCostume, softDeleteCostume } from "@/services/costumes";

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

    if (parsed.data.mediaId) {
      const media = await db.profileMedia.findUnique({
        where: { id: parsed.data.mediaId },
        select: { profileId: true, deletedAt: true },
      });
      if (!media || media.deletedAt || media.profileId !== owned.profileId) {
        return NextResponse.json(
          { data: null, error: "not_found", message: "Photo not found" },
          { status: 404 },
        );
      }
    }

    const item = await db.costumeItem.update({
      where: { id },
      data: parsed.data,
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
