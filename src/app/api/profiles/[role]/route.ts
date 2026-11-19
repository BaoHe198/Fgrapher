import { Role } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { revalidatePublicProfile } from "@/lib/cache";
import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { PROVIDER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { getUpdateProfileSchema } from "@/lib/validations/profile";
import { buildGeocodeAddressHash, forwardGeocode } from "@/services/geocoding";
import { tryAutoPublish } from "@/services/public-profile";
import { ensureDefaultWeeklyHours } from "@/services/resource-calendar";
import { syncPrimaryServiceArea } from "@/services/service-areas";

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
          // The costume catalogue and the photos it can attach. Only
          // COSTUME_SHOP renders them, and a profile's photo list is small
          // (plan-capped), so this is cheaper than a second round trip.
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
              type: true,
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

    // Mirrors the profile's own province into ProfileServiceArea, which is
    // what the "Yêu cầu phù hợp" feed and the new-request broadcast read.
    // Before this, saving a profile in TP.HCM put a provider on the map
    // there and left them matched to nothing there (QA-03) — they had to
    // find the separate "Khu vực phục vụ" panel and re-enter their own
    // province for anything to reach them.
    //
    // The three follow-ups below only need the profile row written above
    // and do not read each other's results, so they run together: one after
    // another they made a first save noticeably slow (owner, 19/11/2026).
    const [, , published] = await Promise.all([
      syncPrimaryServiceArea(profile.id, profile.provinceId),
      // A provider's first profile save starts their week at the default
      // hours, so they can be found and booked before they ever open the
      // calendar (owner, 16/11/2026). No-op once they have any hours.
      !existingProfile && PROVIDER_ROLES.includes(role as Role)
        ? ensureDefaultWeeklyHours(session.user.id)
        : null,
      // Categories and location are requirements gating auto-publish (see
      // tryAutoPublish) — saving them here may be the last one this
      // profile was waiting on.
      tryAutoPublish(session.user.id, role as Role),
    ]);

    // Description, price, categories, location, Model attributes — all of
    // it feeds the public profile and the browse cards. (tryAutoPublish
    // above also invalidates, but only when it actually flips a profile
    // live; an edit to an already-published profile still needs this.)
    await revalidatePublicProfile(session.user.id);

    // `profile` was read before the publish attempt: without this the save
    // that puts a profile live answered "isPublished: false", and the form
    // went on saying "Bản nháp" until the page was reloaded.
    return NextResponse.json(
      {
        data: { ...profile, isPublished: profile.isPublished || published },
        error: null,
        message: t("updated"),
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

    // Not swallowed: a provider reported "could not save" on the preview
    // site (19/11/2026) and nothing had been recorded to say why.
    Sentry.captureException(err);
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
