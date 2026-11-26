import { NextResponse } from "next/server";

import {
  AuthError,
  requireActiveSubscription,
  requireAuth,
} from "@/lib/auth-helpers";
import { revalidatePublicProfile } from "@/lib/cache";
import { db } from "@/lib/db";
import { createCostumeSchema } from "@/lib/validations/costume";
import { listCostumesForOwner, setCostumeGallery } from "@/services/costumes";
import { ownPhotoIds } from "@/services/own-media";

// The catalogue belongs to the costume rental role and nothing else. It is
// NOT behind MARKETPLACE_ENABLED: outfits live on the shop's own profile,
// not on Chợ F (project owner, 21/09/2026).
const CATALOGUE_ROLE = "COSTUME_SHOP" as const;

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const profileId = new URL(request.url).searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: "profileId required",
        },
        { status: 400 },
      );
    }

    const profile = await db.profile.findUnique({ where: { id: profileId } });
    if (!profile || profile.userId !== session.user.id) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: "Not your profile" },
        { status: 403 },
      );
    }

    const items = await listCostumesForOwner(profileId);
    return NextResponse.json(
      { data: items, error: null, message: null },
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
      { data: null, error: "server_error", message: "Failed to load outfits" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createCostumeSchema.safeParse(body);
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

    const profile = await db.profile.findUnique({
      where: { id: parsed.data.profileId },
    });
    if (!profile || profile.userId !== session.user.id) {
      return NextResponse.json(
        {
          data: null,
          error: "forbidden",
          message: "This profile does not belong to you",
        },
        { status: 403 },
      );
    }
    if (profile.role !== CATALOGUE_ROLE) {
      return NextResponse.json(
        {
          data: null,
          error: "forbidden",
          message: "Only a costume rental shop has an outfit catalogue",
        },
        { status: 403 },
      );
    }

    await requireActiveSubscription(session.user.id, profile.role);

    // Every photo must be one of this profile's own, or someone could
    // attach another provider's photo to their own listing by id.
    const { galleryMediaIds = [], ...data } = parsed.data;
    const photoIds = [data.mediaId, ...galleryMediaIds].filter(
      (id): id is string => Boolean(id),
    );
    const own = await ownPhotoIds(profile.id, photoIds);
    if (photoIds.some((id) => !own.has(id))) {
      return NextResponse.json(
        { data: null, error: "not_found", message: "Photo not found" },
        { status: 404 },
      );
    }

    const item = await db.$transaction(async (tx) => {
      const created = await tx.costumeItem.create({ data });
      await setCostumeGallery(
        tx,
        created.id,
        profile.id,
        // The main photo is not also listed as a further one.
        galleryMediaIds.filter((id) => id !== data.mediaId),
      );
      return created;
    });

    await revalidatePublicProfile(session.user.id);

    return NextResponse.json(
      { data: item, error: null, message: "Outfit added" },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to add outfit" },
      { status: 500 },
    );
  }
}
