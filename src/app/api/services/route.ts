import { NextResponse } from "next/server";

import { revalidatePublicProfile } from "@/lib/cache";
import {
  AuthError,
  requireActiveSubscription,
  requireAuth,
} from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PROVIDER_ROLES } from "@/lib/constants";
import { serviceKindAllowedForRole } from "@/lib/constants/service-matrix";
import { createServiceSchema } from "@/lib/validations/service";
import { syncProfileServiceKinds } from "@/services/profile-service-kinds";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const parsed = createServiceSchema.safeParse(body);
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

    if (!PROVIDER_ROLES.includes(profile.role)) {
      return NextResponse.json(
        {
          data: null,
          error: "forbidden",
          message: "This role does not offer bookable services",
        },
        { status: 403 },
      );
    }

    // A role may only offer the services its matrix allows: a make-up artist
    // cannot list a venue, a photographer cannot list modelling. Checked here
    // rather than in the schema because it depends on the profile's role,
    // which the schema cannot see.
    if (!serviceKindAllowedForRole(profile.role, parsed.data.kind)) {
      return NextResponse.json(
        {
          data: null,
          error: "forbidden",
          message: "This role cannot offer that service",
        },
        { status: 403 },
      );
    }

    await requireActiveSubscription(session.user.id, profile.role);

    const service = await db.service.create({ data: parsed.data });

    // serviceKinds on the profile is what search filters on, so it is
    // rewritten from the packages in the same request that changed them.
    await syncProfileServiceKinds(profile.id);

    // Services show on the public profile's Services tab and the booking page.
    await revalidatePublicProfile(session.user.id);

    return NextResponse.json(
      { data: service, error: null, message: "Service created" },
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
      {
        data: null,
        error: "server_error",
        message: "Failed to create service",
      },
      { status: 500 },
    );
  }
}
