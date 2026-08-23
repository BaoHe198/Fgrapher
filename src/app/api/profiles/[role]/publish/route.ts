import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import {
  ProfileHasNoApprovedMediaError,
  ProfileNotFoundError,
  ProfileNotVerifiedError,
  setProfilePublished,
} from "@/services/public-profile";

const bodySchema = z.object({ isPublished: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ role: string }> },
) {
  try {
    const session = await requireAuth();
    const { role } = await params;

    if (!(Object.values(Role) as string[]).includes(role)) {
      return NextResponse.json(
        { data: null, error: "invalid_role", message: "Unknown role" },
        { status: 400 },
      );
    }
    if (!session.user.roles.includes(role as Role)) {
      return NextResponse.json(
        { data: null, error: "forbidden", message: "You don't have this role" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "validation_error", message: "Invalid input" },
        { status: 400 },
      );
    }

    const profile = await setProfilePublished(
      session.user.id,
      role as Role,
      parsed.data.isPublished,
    );

    return NextResponse.json(
      {
        data: profile,
        error: null,
        message: parsed.data.isPublished
          ? "Profile is now live"
          : "Profile unpublished",
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
    if (err instanceof ProfileNotVerifiedError) {
      return NextResponse.json(
        { data: null, error: "not_verified", message: err.message },
        { status: 403 },
      );
    }
    if (err instanceof ProfileNotFoundError) {
      return NextResponse.json(
        { data: null, error: "not_found", message: err.message },
        { status: 404 },
      );
    }
    if (err instanceof ProfileHasNoApprovedMediaError) {
      return NextResponse.json(
        { data: null, error: "no_approved_media", message: err.message },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        data: null,
        error: "server_error",
        message: "Failed to update publish status",
      },
      { status: 500 },
    );
  }
}
