import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { revalidatePublicProfile } from "@/lib/cache";
import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getUpdateProfileSchema } from "@/lib/validations/profile";
import { buildGeocodeAddressHash, forwardGeocode } from "@/services/geocoding";
import { tryAutoPublish } from "@/services/public-profile";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ role: string }> },
) {
  const t = await getTranslations("apiMessages.profiles");
  try {
    const session = await requireAuth();
    const { role } = await params;

    if (!(Object.values(Role) as string[]).includes(role)) {
      return NextResponse.json(
        { data: null, error: "invalid_role", message: t("unknownRole") },
        { status: 400 },
      );
    }

    const [profile, userRole] = await Promise.all([
      db.profile.findUnique({
        where: { userId_role: { userId: session.user.id, role: role as Role } },
        include: {
          services: { orderBy: { createdAt: "asc" } },
          serviceAreas: { select: { provinceId: true } },
          // The costume catalogue and the photos it can attach. Every role
          // gets these two lists; only COSTUME_SHOP renders them, and a
          // profile's own photo list is small (plan-capped).
          costumes: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            include: {
              media: {
                select: { id: true, url: true, moderationStatus: true },
              },
            },
          },
          media: {
            where: { deletedAt: null },
            orderBy: { order: "asc" },
            select: {
              id: true,
              url: true,
              title: true,
              moderationStatus: true,
            },
          },
        },
      }),
      db.userRole.findUnique({
        where: { userId_role: { userId: session.user.id, role: role as Role } },
        select: { verificationStatus: true },
      }),
    ]);

    return NextResponse.json(
      {
        data: profile,
        verificationStatus: userRole?.verificationStatus ?? null,
        error: null,
        message: null,
      },
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
      { data: null, error: "server_error", message: t("loadFailed") },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ role: string }> },
) {
  const t = await getTranslations("apiMessages.profiles");
  try {
    const session = await requireAuth();
    const { role } = await params;

    if (!(Object.values(Role) as string[]).includes(role)) {
      return NextResponse.json(
        { data: null, error: "invalid_role", message: t("unknownRole") },
        { status: 400 },
      );
    }
    if (!session.user.roles.includes(role as Role)) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: t("noRole") },
        { status: 403 },
      );
    }

    const body = await request.json();
    const tValidation = await getTranslations("libServices.validation.profile");
    const parsed = getUpdateProfileSchema(tValidation).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? t("invalidInput"),
        },
        { status: 400 },
      );
    }

    const [ward, existingProfile] = await Promise.all([
      db.ward.findUnique({
        where: { id: parsed.data.wardId },
        select: {
          name: true,
          provinceId: true,
          province: { select: { name: true } },
        },
      }),
      db.profile.findUnique({
        where: { userId_role: { userId: session.user.id, role: role as Role } },
        select: { geocodeAddressHash: true, geocodingStatus: true },
      }),
    ]);
    if (!ward || ward.provinceId !== parsed.data.provinceId) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: t("invalidLocation"),
        },
        { status: 400 },
      );
    }

    // addressPoint is not a Profile column — it only feeds the geocoding
    // fields below, so it must not reach the upsert.
    const { addressPoint, ...profileData } = parsed.data;
    const geocodeInput = {
      address: profileData.address,
      ward: ward.name,
      province: ward.province.name,
    };
    const geocodeAddressHash = buildGeocodeAddressHash(geocodeInput);
    const locationChanged =
      existingProfile?.geocodeAddressHash !== geocodeAddressHash;
    // A profile geocoded before address hashing existed has READY
    // coordinates but no hash; its address is not known to have changed.
    const legacyReadyPoint =
      existingProfile?.geocodeAddressHash == null &&
      existingProfile?.geocodingStatus === "READY";
    // A point picked from the autocomplete list is the provider confirming
    // exactly where they are — use it as-is instead of re-geocoding text.
    const geocode = addressPoint
      ? { success: true as const, ...addressPoint }
      : locationChanged
        ? await forwardGeocode(geocodeInput)
        : null;
    let geocodingData = {};
    if (geocode?.success) {
      geocodingData = {
        latitude: geocode.latitude,
        longitude: geocode.longitude,
        geocodedAt: new Date(),
        geocodeAddressHash,
        geocodingStatus: "READY" as const,
      };
    } else if (geocode && !legacyReadyPoint) {
      // The address really changed: an old coordinate is worse than no
      // marker. Store the new hash so unrelated edits don't re-call
      // MapTiler; PENDING (not FAILED) when no key is configured, so the
      // backfill script picks it up once one is.
      geocodingData = {
        latitude: null,
        longitude: null,
        geocodedAt: null,
        geocodeAddressHash,
        geocodingStatus:
          geocode.reason === "not_configured"
            ? ("PENDING" as const)
            : ("FAILED" as const),
      };
    }
    // legacyReadyPoint + failed geocode: keep the existing point and leave
    // the hash null so a later save (or the backfill) retries.

    const profile = await db.profile.upsert({
      where: { userId_role: { userId: session.user.id, role: role as Role } },
      create: {
        userId: session.user.id,
        role: role as Role,
        ...profileData,
        ...geocodingData,
      },
      update: { ...profileData, ...geocodingData },
    });

    // Categories and location are requirements
    // gating auto-publish (see tryAutoPublish) — saving them here may be
    // the last one this profile was waiting on.
    await tryAutoPublish(session.user.id, role as Role);

    // Description, price, categories, location, Model attributes — all of
    // it feeds the public profile and the browse cards. (tryAutoPublish
    // above also invalidates, but only when it actually flips a profile
    // live; an edit to an already-published profile still needs this.)
    await revalidatePublicProfile(session.user.id);

    return NextResponse.json(
      { data: profile, error: null, message: t("updated") },
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
      {
        data: null,
        error: "server_error",
        message: t("updateFailed"),
      },
      { status: 500 },
    );
  }
}
