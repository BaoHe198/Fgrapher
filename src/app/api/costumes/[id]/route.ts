import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { revalidatePublicProfile } from "@/lib/cache";
import { findOwnedCostume, softDeleteCostume } from "@/services/costumes";

export async function PATCH() {
  try {
    await requireAuth();
    return NextResponse.json(
      {
        data: null,
        error: "catalogue_retired",
        message: "Manage products in Chợ F instead",
      },
      { status: 410 },
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
