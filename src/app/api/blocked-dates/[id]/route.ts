import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { deleteBlock } from "@/services/resource-calendar";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("apiMessages.blockedDates");
  try {
    const session = await requireAuth();
    const { id } = await params;

    // deleteBlock only removes a block that belongs to this provider's own
    // calendar, so ownership and deletion are one query rather than two.
    const deleted = await deleteBlock(id, session.user.id);
    if (!deleted) {
      return NextResponse.json(
        { data: null, error: "not_found", message: t("notFound") },
        { status: 404 },
      );
    }

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
