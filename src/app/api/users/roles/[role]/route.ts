import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { PAID_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";

// MVP-stage self-service undo — a role self-activated via POST
// /api/users/roles (no real billing gate yet) can be self-removed too,
// but only while it's still abandoned: never verified. Once VERIFIED,
// removal has to go through an admin, same as everything else billing-
// adjacent while BILLING_ENABLED=false. Profile rows cascade-delete their
// Services/Albums/etc.; UserRole cascade-deletes its Subscription.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ role: string }> },
) {
  const t = await getTranslations("apiMessages.roles");
  try {
    const session = await requireAuth();
    const { role } = await params;

    if (!(PAID_ROLES as string[]).includes(role)) {
      return NextResponse.json(
        { data: null, error: "invalid_role", message: t("invalidRole") },
        { status: 400 },
      );
    }

    const userRole = await db.userRole.findUnique({
      where: { userId_role: { userId: session.user.id, role: role as Role } },
      select: { verificationStatus: true },
    });
    if (!userRole) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("roleNotFound") },
        { status: 404 },
      );
    }
    if (userRole.verificationStatus === "VERIFIED") {
      return NextResponse.json(
        {
          data: null,
          error: "already_verified",
          message: t("cannotRemoveVerified"),
        },
        { status: 400 },
      );
    }

    await db.$transaction([
      db.profile.deleteMany({
        where: { userId: session.user.id, role: role as Role },
      }),
      db.userRole.delete({
        where: {
          userId_role: { userId: session.user.id, role: role as Role },
        },
      }),
    ]);

    return NextResponse.json(
      { data: { role }, error: null, message: t("removed") },
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
      { data: null, error: "server_error", message: t("removeFailed") },
      { status: 500 },
    );
  }
}
