import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.blockedDates");
  try {
    const session = await requireAuth();
    const { id } = await params;

    const blockedDate = await db.blockedDate.findUnique({ where: { id } });
    if (!blockedDate || blockedDate.userId !== session.user.id) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("notFound") },
        { status: 404 },
      );
    }

    await db.blockedDate.delete({ where: { id } });

    return NextResponse.json(
      { data: null, error: null, message: t("unblocked") },
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
      { data: null, error: "server_error", message: t("unblockFailed") },
      { status: 500 },
    );
  }
}
