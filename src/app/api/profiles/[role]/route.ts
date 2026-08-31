import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getUpdateProfileSchema } from "@/lib/validations/profile";
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

    const profile = await db.profile.upsert({
      where: { userId_role: { userId: session.user.id, role: role as Role } },
      create: { userId: session.user.id, role: role as Role, ...parsed.data },
      update: parsed.data,
    });

    // Categories (and, for STUDIO, location) are two of the requirements
    // gating auto-publish (see tryAutoPublish) — saving them here may be
    // the last one this profile was waiting on.
    await tryAutoPublish(session.user.id, role as Role);

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
